import { sql } from "./_lib/db.js"

// Latest market data (price, market cap, next earnings date) per company —
// see db/migrations/008 and api/_lib/fetchMarketData.js, which populates
// this table from Finnhub during the daily ingest run. Current-state
// (upserted, one row per company_key), unlike company_sentiment's
// append-only history — no DISTINCT ON needed. Read-only, behind the
// dashboard's normal Basic auth, same as api/sentiment.js.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const rows = await sql`
      SELECT
        company_key AS "companyKey",
        company_name AS "companyName",
        ticker,
        exchange,
        price,
        price_change_pct AS "priceChangePct",
        market_cap AS "marketCap",
        to_char(next_earnings_date, 'YYYY-MM-DD') AS "nextEarningsDate",
        updated_at AS "updatedAt"
      FROM company_market_data
    `
    res.status(200).json(rows)
  } catch (err) {
    console.error("GET /api/market-data failed:", err)
    res.status(500).json({ error: "Failed to load market data" })
  }
}
