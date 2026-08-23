// Deterministic entity -> tracked-company matching.
//
// A signal's "entity" is free text the normalizer wrote ("National
// Australia Bank (NAB)", "OAIC / Qantas Airways", "Reserve Bank of
// Australia"). This maps it back to the companies you've chosen to track
// (tracked_companies table) so a signal can be filed under the right
// account instead of just its raw headline entity string.
//
// Deliberately rule-based rather than another LLM call: it runs on every
// ingested item, the answer is a lookup rather than a judgment, and a
// wrong match (filing a signal under the wrong company) is worse than no
// match at all — so this errs hard towards precision.
import { companyKey as normalizeCompanyName } from "../../shared/companyKey.js"

export { normalizeCompanyName }

// Below this length a lone token is too collision-prone to loose-match on
// its own (3M, AON, BHP). Exact whole-string equality still works.
const MIN_LOOSE_TOKEN_LENGTH = 6

// One entity string can name more than one organisation — the normalizer
// writes "OAIC / Qantas Airways" for a regulator acting on a company, and
// "Medallia / Atombit" for an acquisition. Split those apart, and treat a
// trailing "(NAB)" as its own candidate so both the long form and the
// abbreviation get a shot at matching.
function candidatesFor(entity) {
  const raw = String(entity ?? "")
  const parts = raw
    .split(/\s*[/|,]\s*|\s+&\s+|\s+vs\.?\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)

  const candidates = new Set()
  for (const part of [raw, ...parts]) {
    candidates.add(part)
    for (const paren of part.matchAll(/\(([^)]+)\)/g)) candidates.add(paren[1])
    const withoutParens = part.replace(/\([^)]*\)/g, " ").trim()
    if (withoutParens) candidates.add(withoutParens)
  }
  return [...candidates].filter(Boolean)
}

/**
 * Builds a matcher scoped to one list of tracked companies (fetched fresh
 * from the DB each ingest run, since the list changes whenever you add or
 * remove a company — there's no static file to import here).
 */
export function buildCompanyMatcher(trackedCompanies) {
  const byKey = new Map()
  for (const company of trackedCompanies) {
    // First writer wins so a duplicate key is stable rather than flapping.
    if (!byKey.has(company.companyKey)) byKey.set(company.companyKey, company)
  }

  const looseKeysByLength = new Map()
  for (const key of byKey.keys()) {
    const tokens = key.split(" ")
    if (tokens.length === 1 && key.length < MIN_LOOSE_TOKEN_LENGTH) continue
    if (!looseKeysByLength.has(tokens.length)) looseKeysByLength.set(tokens.length, new Set())
    looseKeysByLength.get(tokens.length).add(key)
  }
  const LOOSE_LENGTHS = [...looseKeysByLength.keys()].sort((a, b) => b - a)

  /**
   * Resolve a signal entity to companies on your tracked list. Returns []
   * when the entity names nothing you're tracking, which is the common
   * case for macro, regulatory or general market news.
   */
  function matchCompanies(entity) {
    const matched = new Map()

    for (const candidate of candidatesFor(entity)) {
      const key = normalizeCompanyName(candidate)
      if (!key) continue

      const exact = byKey.get(key)
      if (exact) {
        matched.set(exact.companyKey, exact)
        continue
      }

      // No exact hit: look for a tracked-company key sitting inside the
      // candidate ("Woolworths customer experience" -> "woolworths").
      // Longest n-gram first so a two-word company name wins over a
      // shorter substring of it.
      const tokens = key.split(" ")
      for (const length of LOOSE_LENGTHS) {
        if (length > tokens.length) continue
        const keys = looseKeysByLength.get(length)
        for (let i = 0; i + length <= tokens.length; i += 1) {
          const gram = tokens.slice(i, i + length).join(" ")
          if (keys.has(gram)) {
            const company = byKey.get(gram)
            if (company) matched.set(company.companyKey, company)
          }
        }
        if (matched.size) break
      }
    }

    return [...matched.values()]
  }

  /**
   * The full attribution for a signal entity: which tracked companies it
   * names, and whether any of them is flagged as a competitor (so ingest
   * can decide whether it's outreach news or positioning news).
   */
  function attributeEntity(entity) {
    const companies = matchCompanies(entity)
    return {
      matchedCompanies: companies.map((c) => c.companyName),
      matchedCompetitor: companies.some((c) => c.isCompetitor),
    }
  }

  return { matchCompanies, attributeEntity }
}
