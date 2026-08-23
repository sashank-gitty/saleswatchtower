// Canonical company-name normalization — the one place this logic lives,
// used identically on the server (api/_lib/matchCompanies.js, matching a
// signal's entity against your tracked list at ingest time) and in the
// browser (src/lib/accountModel.js, grouping signals into account rows).
// Keeping one shared function instead of two similar ones is what
// guarantees a company typed into "Track a company" always resolves to
// the same key a signal about it gets filed under.
const LEGAL_SUFFIXES =
  /\b(pty|proprietary|ltd|limited|inc|incorporated|llc|plc|co|company|corp|corporation|holdings|holding|group|the|and)\b/g

export function companyKey(name) {
  const original = String(name ?? "").trim().toLowerCase()
  const normalized = original
    // Parenthetical qualifiers are dropped before anything else: entity
    // strings arrive as "NICE (CXone)" and bare "NICE" for the same
    // company, and keeping the parenthetical would file one company
    // under two keys.
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,'"&/]/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  // Guard against a name that's nothing but legal-suffix words collapsing
  // to an empty key that would then match everything.
  return normalized || original
}
