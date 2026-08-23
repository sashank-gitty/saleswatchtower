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
export const STANDING_WATCHLIST = []

// A generous cap on how many tracked companies get queried by name in one
// run, so a very large list can't blow out the ingest function's time
// limit. Most people tracking companies by hand will never come close to
// this; if you do, the most recently added companies are queried first
// and the rest wait for the next run.
const MAX_TRACKED_QUERIES_PER_RUN = 150

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

/**
 * The full list of queries for one ingest run.
 */
export async function watchlistForRun() {
  const companyQueries = await trackedCompanyQueries()
  return [...STANDING_WATCHLIST, ...companyQueries]
}
