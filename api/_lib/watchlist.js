import { sql } from "./db.js"

// What the ingest pipeline searches the news for, each run: every company
// on your tracked list (see api/companies.js — this is the entire "setup"
// this app needs) plus anything in STANDING_WATCHLIST below.
//
// This used to be driven by a hand-imported, single-employer territory
// book. Now it's driven entirely by the tracked_companies table, so
// adding a company through the UI is the whole story — the next run picks
// it up automatically, no file to edit or list to regenerate.

// Optional: standing thematic searches that run every time, independent
// of any specific company you're tracking — useful if you want a running
// watch on your own industry or region's news (a regulator, a market
// trend). Empty by default; add plain search terms here if you want them,
// one becomes one RSS query per run.
//
// Set to a global + ANZ (Australia/New Zealand) macro-news mix by
// default for this deployment — broad economic, market and regulatory
// developments rather than any single company. Edit or clear this array
// for a different region/focus; it's a plain list, nothing else reads it.
export const STANDING_WATCHLIST = [
  // Global macro
  "global economic outlook",
  "global markets news",
  "interest rate decision",
  "global inflation report",
  "supply chain disruption",
  "geopolitical risk business",
  "AI industry trends",
  "tech industry layoffs",
  // Australia / New Zealand macro
  "Australia economy news",
  "Reserve Bank of Australia interest rate",
  "Australian business news",
  "ASX company news",
  "Australia regulation business",
  "New Zealand economy news",
  "Reserve Bank of New Zealand interest rate",
]

// A generous cap on how many tracked companies get queried by name in one
// run, so a very large list can't blow out the ingest function's time
// limit. Most people tracking companies by hand will never come close to
// this; if you do, the most recently added companies are queried first
// and the rest wait for the next run.
const MAX_TRACKED_QUERIES_PER_RUN = 150

// Hard ceiling on the *total* number of RSS queries one run makes, across
// every source combined (company names, the exec/press-release variant
// below, and STANDING_WATCHLIST). Production runs as a Vercel serverless
// function with a 60-second limit (vercel.json's maxDuration) — see the
// concurrency comment in fetchNews.js, which already documents that
// budget as tight even before the exec/press-release queries below
// existed. Self-hosting (see HOSTING.md) has no such timeout; raise this
// freely there.
const MAX_QUERIES_PER_RUN = 120

// Company names are often legal entity names, sometimes in caps
// ("BRIDGESTONE MINING SOLUTIONS AUSTRALIA PTY LTD"). Google News does
// better with the trading name, so drop the legal suffix and de-shout.
function toSearchQuery(name) {
  const trimmed = name
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(pty\.?|proprietary|ltd\.?|limited|inc\.?|incorporated|llc|plc)\b/gi,
      " ",
    )
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Only re-case names that are shouted; leave "Rea Group Ltd." alone.
  const deShouted =
    trimmed === trimmed.toUpperCase()
      ? trimmed
          .toLowerCase()
          .replace(/\b[a-z]/g, (c) => c.toUpperCase())
      : trimmed
  return deShouted
}

/**
 * Every company you're tracking, turned into a search query. Queried
 * regardless of whether it's flagged a competitor or not — you track a
 * competitor specifically because you want their news too.
 */
export async function trackedCompanyQueries() {
  const rows = await sql`
    SELECT company_name FROM tracked_companies
    ORDER BY created_at DESC
    LIMIT ${MAX_TRACKED_QUERIES_PER_RUN}
  `
  return [...new Set(rows.map((row) => toSearchQuery(row.company_name)).filter(Boolean))].sort()
}

// Two extra queries per company, for executive public statements and
// press-release wire coverage — a plain "{Company Name}" search sometimes
// misses these because Google News only returns each query's top 10
// results (fetchNews.js), and a big headline that day can crowd out a
// smaller CEO-quote or wire story.
//
// Kept as two separate, narrow queries rather than one combined query —
// tried combining them first (one query ORing the CEO/CFO terms together
// with the site: terms) and checked the real results: past a certain
// complexity, Google News' RSS search silently stops requiring the
// company-name match at all and returns generic, unrelated news. Each of
// these two stayed on-topic when checked individually; the combined one
// didn't.
function execQuery(searchName) {
  return `"${searchName}" (CEO OR CFO OR "chief executive")`
}

function pressReleaseQuery(searchName) {
  return `"${searchName}" (site:prnewswire.com OR site:businesswire.com OR site:globenewswire.com)`
}

/**
 * The full list of queries for one ingest run, capped at
 * MAX_QUERIES_PER_RUN. Ordered by priority for when it has to trim: plain
 * company-name queries first (everything else in this app depends on
 * these existing), then the standing macro list, then the exec-statement
 * and press-release queries last, interleaved so a partial trim doesn't
 * wipe out one of the two entirely — those are pure enrichment on top of
 * the company watch, so they're what gets cut under pressure.
 */
export async function watchlistForRun() {
  const companyQueries = await trackedCompanyQueries()
  const enrichmentQueries = companyQueries.flatMap((name) => [execQuery(name), pressReleaseQuery(name)])
  const all = [...companyQueries, ...STANDING_WATCHLIST, ...enrichmentQueries]
  return all.slice(0, MAX_QUERIES_PER_RUN)
}
