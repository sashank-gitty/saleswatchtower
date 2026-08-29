// Real ASX (Australian Securities Exchange) company announcements —
// earnings and annual-report signals sourced directly from ASX's own data,
// not press coverage of them. Only covers companies actually listed on the
// ASX (tracked_companies.asx_ticker set); everything else is skipped.
//
// Endpoint found by inspecting asx.com.au's own announcements widget, not
// from documented public API docs — ASX's site is now served by Markit
// Digital (an S&P Global product), and this is the JSON call its own
// per-company page makes. Same category of risk as the Google News RSS
// fetch in fetchNews.js: best-effort, could change or break without
// notice, one company's failure doesn't sink the run.
//
// Known limitation, confirmed by hand against several large ASX
// companies: this endpoint only ever returns a company's 5 most recent
// announcements, with no working pagination parameter. A Full Year or
// Half Year Results announcement is almost always the standout
// announcement on the day it's filed, so a daily run reliably catches it
// in practice — but a company that files several unrelated announcements
// the same day, or a run that misses several days in a row, could see an
// older report scroll out of the window before it's ever picked up.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

function announcementsUrl(ticker) {
  return `https://asx.api.markitdigital.com/asx-research/1.0/companies/${encodeURIComponent(ticker)}/announcements`
}

// ASX's own classification for financial/periodic filings — covers Full
// Year and Half Year results, Annual Reports, Pillar 3 disclosures, and
// corporate governance statements. Filtering on this real field, straight
// from ASX's own data, is far more reliable than guessing from headline
// keywords.
const REPORT_ANNOUNCEMENT_TYPE = "PERIODIC REPORTS"

async function fetchTickerAnnouncements(ticker) {
  const res = await fetch(announcementsUrl(ticker), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`ASX announcements request failed: ${res.status}`)
  const body = await res.json()
  return body?.data?.items ?? []
}

/**
 * Real ASX filings for every tracked company that has an asx_ticker set.
 * Each returned item already names exactly one known company, so — unlike
 * news items — no LLM entity-matching or normalization is needed
 * downstream; ingest.js inserts these directly.
 */
export async function fetchAsxFilings(trackedCompanies) {
  const items = []
  const errors = []

  const withTicker = trackedCompanies.filter((c) => c.asxTicker)

  for (const company of withTicker) {
    try {
      const announcements = await fetchTickerAnnouncements(company.asxTicker)
      for (const a of announcements) {
        if (a.announcementType !== REPORT_ANNOUNCEMENT_TYPE) continue
        items.push({
          companyKey: company.companyKey,
          companyName: company.companyName,
          headline: a.headline,
          pubDate: a.date ? new Date(a.date) : null,
          // The API doesn't return a working per-document link (empty
          // string on every item observed while building this) — link to
          // the company's real ASX profile page instead of guessing at a
          // PDF URL that might 404. Real and always-correct, just one
          // click short of the exact document.
          sourceUrl: `https://www.asx.com.au/markets/company/${company.asxTicker}`,
          // Distinct per filing even though sourceUrl is shared across a
          // company's filings — dedupe_key has to be, or every filing
          // after the first for a given company would look like a repeat
          // and get silently dropped.
          dedupeKey: `asx-${company.asxTicker}-${a.documentKey}`,
        })
      }
    } catch (err) {
      console.error(`ASX fetch failed for ${company.asxTicker}:`, err.message)
      errors.push({ ticker: company.asxTicker, message: err.message })
    }
  }

  return { items, errors }
}
