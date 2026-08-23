import { createHash } from "node:crypto"
import { sql } from "./_lib/db.js"
import { fetchWatchlist } from "./_lib/fetchNews.js"
import { normalizeItem, BudgetExceededError } from "./_lib/normalize.js"
import { buildCompanyMatcher } from "./_lib/matchCompanies.js"
import { watchlistForRun } from "./_lib/watchlist.js"

// Hard cap on LLM normalization calls per run — bounds both cost and
// Vercel function execution time regardless of how many raw RSS items
// come back across the whole watchlist.
const MAX_ITEMS_PER_RUN = 25

function cleanTitle(rawTitle) {
  // Google News RSS titles are typically "Real Headline - Publisher Name".
  // Strip the trailing " - Publisher" segment when present.
  const parts = rawTitle.split(" - ")
  return parts.length > 1 ? parts.slice(0, -1).join(" - ").trim() : rawTitle.trim()
}

function toDateString(date) {
  if (!date || Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function idFor(dedupeKey) {
  return `news-${createHash("sha1").update(dedupeKey).digest("hex").slice(0, 16)}`
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const authHeader = req.headers.authorization
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const summary = {
    queried: 0,
    rawItems: 0,
    afterDedupe: 0,
    normalized: 0,
    inserted: 0,
    // How many of the inserted signals named a company on your tracked
    // list. Worth watching: if this stays at zero run after run with a
    // non-empty tracked list, the company names you typed in aren't
    // matching what the news calls them — check for a spelling mismatch.
    companyMatched: 0,
    errors: [],
    // Set true if the monthly Claude API budget (api/_lib/budget.js) was
    // hit mid-run — the remaining candidates were left un-normalized on
    // purpose, not dropped by a bug.
    budgetExceeded: false,
  }

  try {
    const trackedCompanies = await sql`
      SELECT company_key, company_name, is_competitor FROM tracked_companies
    `
    const matcher = buildCompanyMatcher(
      trackedCompanies.map((row) => ({
        companyKey: row.company_key,
        companyName: row.company_name,
        isCompetitor: row.is_competitor,
      })),
    )

    const watchlist = await watchlistForRun()
    summary.queried = watchlist.length

    const existing = await sql`SELECT dedupe_key FROM signals`
    const existingKeys = new Set(existing.map((r) => r.dedupe_key))

    const rawItems = await fetchWatchlist(watchlist)
    summary.rawItems = rawItems.length

    const seenInBatch = new Set()
    const candidates = rawItems
      .filter((item) => {
        if (existingKeys.has(item.sourceUrl)) return false
        if (seenInBatch.has(item.sourceUrl)) return false
        seenInBatch.add(item.sourceUrl)
        return true
      })
      .sort((a, b) => (b.pubDate?.getTime() ?? 0) - (a.pubDate?.getTime() ?? 0))
      .slice(0, MAX_ITEMS_PER_RUN)

    summary.afterDedupe = candidates.length

    // Bounded concurrency again — sequential Claude calls for up to
    // MAX_ITEMS_PER_RUN items would otherwise dominate the function's
    // execution time on their own.
    const NORMALIZE_CONCURRENCY = 4
    const queue = [...candidates]

    async function worker() {
      while (queue.length) {
        const raw = queue.shift()
        try {
          if (summary.budgetExceeded) return
          const normalized = await normalizeItem(raw)
          if (!normalized) continue
          summary.normalized += 1

          const { matchedCompanies } = matcher.attributeEntity(normalized.entity)
          if (matchedCompanies.length) summary.companyMatched += 1

          const dedupeKey = raw.sourceUrl
          await sql`
            INSERT INTO signals (id, headline, summary, source_url, date, scope, entity, signal_type, origin, dedupe_key, outreach_relevance, matched_companies)
            VALUES (
              ${idFor(dedupeKey)},
              ${cleanTitle(raw.title)},
              ${normalized.summary},
              ${raw.sourceUrl},
              ${toDateString(raw.pubDate)},
              ${normalized.scope},
              ${normalized.entity},
              ${normalized.signalType},
              'news',
              ${dedupeKey},
              ${normalized.outreachRelevance},
              ${matchedCompanies}
            )
            ON CONFLICT (dedupe_key) DO NOTHING
          `
          summary.inserted += 1
        } catch (err) {
          if (err instanceof BudgetExceededError) {
            console.warn("ingest:", err.message)
            summary.budgetExceeded = true
            return
          }
          console.error("ingest: failed on item", raw.sourceUrl, err)
          summary.errors.push({ url: raw.sourceUrl, message: err.message })
        }
      }
    }

    await Promise.all(Array.from({ length: NORMALIZE_CONCURRENCY }, worker))

    await logRun("success", summary)
    res.status(200).json(summary)
  } catch (err) {
    console.error("POST /api/ingest failed:", err)
    await logRun("error", summary, err.message)
    res.status(500).json({ error: "Ingestion run failed", message: err.message, summary })
  }
}

// Best-effort: a logging failure shouldn't turn a real ingest success into
// an error response, so this swallows its own errors rather than throwing.
async function logRun(status, summary, errorMessage = null) {
  try {
    await sql`
      INSERT INTO ingest_runs (status, summary, error_message)
      VALUES (${status}, ${JSON.stringify(summary)}, ${errorMessage})
    `
  } catch (err) {
    console.error("ingest: failed to log run:", err)
  }
}
