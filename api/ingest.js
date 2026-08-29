import { createHash } from "node:crypto"
import { sql } from "./_lib/db.js"
import { fetchWatchlist } from "./_lib/fetchNews.js"
import { normalizeItem, BudgetExceededError } from "./_lib/normalize.js"
import { buildCompanyMatcher } from "./_lib/matchCompanies.js"
import { watchlistForRun } from "./_lib/watchlist.js"
import { fetchAsxFilings } from "./_lib/fetchAsxFilings.js"
import { fetchMarketData } from "./_lib/fetchMarketData.js"
import { researchCompanyDomain } from "./_lib/companyProfile.js"
import { companyKey } from "../shared/companyKey.js"

// Cap on light logo lookups per run (see the block after ingest below) —
// each is a short, single completion, so this is generous relative to
// the run's real time budget while still keeping one run from trying to
// backfill dozens of companies at once. Whatever doesn't fit this run
// picks up on the next daily run — self-healing, not a hard deadline.
const MAX_LOGOS_PER_RUN = 5

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

function idFor(dedupeKey, prefix = "news") {
  return `${prefix}-${createHash("sha1").update(dedupeKey).digest("hex").slice(0, 16)}`
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
    // RSS fetch failures (a query that couldn't be searched at all —
    // network issue, feed error, etc.), distinct from `errors` above
    // (failures normalizing/saving an item that WAS fetched).
    fetchErrors: [],
    // Set true if the monthly Claude API budget (api/_lib/budget.js) was
    // hit mid-run — the remaining candidates were left un-normalized on
    // purpose, not dropped by a bug.
    budgetExceeded: false,
    // Real ASX filings (api/_lib/fetchAsxFilings.js) — separate from the
    // news counts above since these skip normalizeItem() entirely (no LLM
    // call needed, see that file for why) and only run for companies with
    // an asx_ticker set.
    asxQueried: 0,
    asxInserted: 0,
    asxErrors: [],
    // Real market data (api/_lib/fetchMarketData.js, Finnhub) — a
    // current-state upsert into company_market_data, not a signals
    // insert, so there's no "inserted" count the same shape as the
    // sources above; "updated" is how many companies got a fresh row.
    marketDataQueried: 0,
    marketDataUpdated: 0,
    marketDataErrors: [],
    // Light logo-only company_profiles rows (api/_lib/companyProfile.js's
    // researchCompanyDomain, api/company-logos.js) — covers every account
    // that shows up in the feed, tracked or not, not just companies
    // you've deliberately tracked (those get the full profile instead,
    // via api/company-profile.js).
    logosQueried: 0,
    logosInserted: 0,
    logosErrors: [],
  }

  try {
    const trackedCompanies = await sql`
      SELECT company_key, company_name, is_competitor, asx_ticker, stock_ticker FROM tracked_companies
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

    const { items: rawItems, errors: fetchErrors } = await fetchWatchlist(watchlist)
    summary.rawItems = rawItems.length
    summary.fetchErrors = fetchErrors

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

    // ASX filings: no Claude normalization step, see fetchAsxFilings.js —
    // each item already names exactly one known company and a known
    // report type, so the summary is built directly from real fields
    // rather than judged by the LLM.
    const companiesWithTickers = trackedCompanies
      .filter((row) => row.asx_ticker)
      .map((row) => ({ companyKey: row.company_key, companyName: row.company_name, asxTicker: row.asx_ticker }))
    summary.asxQueried = companiesWithTickers.length

    const { items: asxItems, errors: asxFetchErrors } = await fetchAsxFilings(companiesWithTickers)
    summary.asxErrors = asxFetchErrors

    for (const filing of asxItems) {
      if (existingKeys.has(filing.dedupeKey)) continue
      if (seenInBatch.has(filing.dedupeKey)) continue
      seenInBatch.add(filing.dedupeKey)

      try {
        await sql`
          INSERT INTO signals (id, headline, summary, source_url, date, scope, entity, signal_type, origin, dedupe_key, outreach_relevance, matched_companies)
          VALUES (
            ${idFor(filing.dedupeKey, "filing")},
            ${filing.headline},
            ${`${filing.companyName} lodged "${filing.headline}" with the ASX on ${toDateString(filing.pubDate)}.`},
            ${filing.sourceUrl},
            ${toDateString(filing.pubDate)},
            'micro',
            ${filing.companyName},
            'earnings',
            'filing',
            ${filing.dedupeKey},
            -- Fixed relevance rather than an LLM judgment call: a real
            -- earnings/annual report filing is consistently a strong
            -- outreach trigger, not something worth a per-item Claude
            -- call to score.
            4,
            ${[filing.companyName]}
          )
          ON CONFLICT (dedupe_key) DO NOTHING
        `
        summary.asxInserted += 1
      } catch (err) {
        console.error("ingest: failed on ASX filing", filing.dedupeKey, err)
        summary.asxErrors.push({ ticker: filing.companyKey, message: err.message })
      }
    }

    // Market data: current-state context (price, market cap, next
    // earnings date), not a discrete event, so this upserts into
    // company_market_data directly rather than inserting into signals —
    // same reasoning as company_profiles. Plain REST, no LLM involved.
    const companiesWithStockTickers = trackedCompanies
      .filter((row) => row.stock_ticker)
      .map((row) => ({ companyKey: row.company_key, companyName: row.company_name, stockTicker: row.stock_ticker }))
    summary.marketDataQueried = companiesWithStockTickers.length

    const { items: marketDataItems, errors: marketDataFetchErrors } = await fetchMarketData(companiesWithStockTickers)
    summary.marketDataErrors = marketDataFetchErrors

    for (const data of marketDataItems) {
      try {
        await sql`
          INSERT INTO company_market_data (
            company_key, company_name, ticker, exchange, price, price_change_pct, market_cap, next_earnings_date
          )
          VALUES (
            ${data.companyKey}, ${data.companyName}, ${data.ticker}, ${data.exchange},
            ${data.price}, ${data.priceChangePct}, ${data.marketCap}, ${data.nextEarningsDate}
          )
          ON CONFLICT (company_key) DO UPDATE SET
            ticker = EXCLUDED.ticker,
            exchange = EXCLUDED.exchange,
            price = EXCLUDED.price,
            price_change_pct = EXCLUDED.price_change_pct,
            market_cap = EXCLUDED.market_cap,
            next_earnings_date = EXCLUDED.next_earnings_date,
            updated_at = now()
        `
        summary.marketDataUpdated += 1
      } catch (err) {
        console.error("ingest: failed on market data", data.companyKey, err)
        summary.marketDataErrors.push({ ticker: data.ticker, message: err.message })
      }
    }

    // Light logo backfill: every distinct company a micro-scope signal
    // has ever named, tracked or not, that doesn't have a company_profiles
    // row yet. Deliberately reads from the whole signals table, not just
    // this run's new items — a backlog from before this existed, or from
    // a run that hit MAX_LOGOS_PER_RUN, gets picked up here too.
    const microEntities = await sql`
      SELECT DISTINCT entity FROM signals WHERE scope = 'micro' AND entity IS NOT NULL
    `
    const existingProfileKeys = new Set((await sql`SELECT company_key FROM company_profiles`).map((r) => r.company_key))

    const missingLogos = []
    const seenKeys = new Set()
    for (const row of microEntities) {
      const key = companyKey(row.entity)
      if (!key || existingProfileKeys.has(key) || seenKeys.has(key)) continue
      seenKeys.add(key)
      missingLogos.push({ key, name: row.entity })
    }
    summary.logosQueried = missingLogos.length

    for (const company of missingLogos.slice(0, MAX_LOGOS_PER_RUN)) {
      try {
        const result = await researchCompanyDomain(company.name)
        if (!result) continue
        await sql`
          INSERT INTO company_profiles (company_key, company_name, domain, logo_url)
          VALUES (${company.key}, ${company.name}, ${result.domain}, ${result.logoUrl})
          ON CONFLICT (company_key) DO NOTHING
        `
        summary.logosInserted += 1
      } catch (err) {
        if (err instanceof BudgetExceededError) {
          console.warn("ingest: logo backfill hit the monthly Claude budget, stopping early")
          break
        }
        console.error("ingest: failed to fetch logo for", company.name, err)
        summary.logosErrors.push({ company: company.name, message: err.message })
      }
    }

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
