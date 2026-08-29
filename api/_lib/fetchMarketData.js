// Real market data (price, market cap, next earnings date) via Finnhub's
// free tier — 60 requests/minute, no card required, verified against the
// real API before wiring this in. Chosen over Alpha Vantage, whose free
// tier is capped at 25 requests/DAY — too restrictive for even a small
// watchlist checked daily.
//
// Sibling of fetchAsxFilings.js: same shape (one function per tracked
// company that has the relevant optional field set, best-effort, one
// company's failure doesn't sink the run), but this is plain REST — no
// LLM involved, so no budget check and no timeout risk the way
// companyProfile.js's web-search-driven calls had.
//
// Confirmed directly, not just documented: US tickers (tested CVX,
// TENB) return real data on the free tier. ASX tickers (tested NAB.AX)
// come back 403 — Finnhub's free tier genuinely does not cover the ASX,
// not just "thinner data." Handled the same as any other per-company
// failure below (caught, logged, doesn't sink the run) — for ASX-listed
// companies, fetchAsxFilings.js's real filings remain the only working
// market-context source in this app.
const BASE_URL = "https://finnhub.io/api/v1"

async function finnhubGet(path, params) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set("token", process.env.FINNHUB_API_KEY)

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Finnhub ${path} request failed: ${res.status}`)
  return res.json()
}

function todayPlusDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function fetchOneCompany(ticker) {
  const [quote, profile, earnings] = await Promise.all([
    finnhubGet("/quote", { symbol: ticker }),
    finnhubGet("/stock/profile2", { symbol: ticker }),
    finnhubGet("/calendar/earnings", { symbol: ticker, from: todayPlusDays(0), to: todayPlusDays(90) }),
  ])

  // A ticker Finnhub doesn't recognize comes back as an empty object from
  // /quote (all fields 0) rather than an HTTP error — treat that as "no
  // data" instead of inserting a row of zeros that would read as a real
  // (and wrong) $0 price.
  if (!quote.c) return null

  const nextEarnings = (earnings.earningsCalendar ?? [])
    .map((e) => e.date)
    .filter(Boolean)
    .sort()[0]

  return {
    ticker,
    exchange: profile.exchange ?? null,
    price: quote.c,
    priceChangePct: quote.dp ?? null,
    marketCap: profile.marketCapitalization ?? null,
    nextEarningsDate: nextEarnings ?? null,
  }
}

/**
 * Real market data for every tracked company that has a stock_ticker set.
 * Each returned item already names exactly one known company, so — like
 * fetchAsxFilings.js — no LLM entity-matching is needed downstream;
 * ingest.js upserts these directly into company_market_data.
 */
export async function fetchMarketData(trackedCompanies) {
  const items = []
  const errors = []

  const withTicker = trackedCompanies.filter((c) => c.stockTicker)

  for (const company of withTicker) {
    try {
      const data = await fetchOneCompany(company.stockTicker)
      if (data) {
        items.push({
          companyKey: company.companyKey,
          companyName: company.companyName,
          ...data,
        })
      }
    } catch (err) {
      console.error(`Finnhub fetch failed for ${company.stockTicker}:`, err.message)
      errors.push({ ticker: company.stockTicker, message: err.message })
    }
  }

  return { items, errors }
}
