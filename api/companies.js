import { sql } from "./_lib/db.js"

// The tracked-companies list — the single thing this app asks you to set
// up. GET lists every company you're watching; POST adds or updates one;
// DELETE stops tracking one. The next /api/ingest run automatically picks
// up any change here — there's no separate "sync" step.
export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT
          tc.company_key, tc.company_name, tc.status, tc.is_competitor, tc.note, tc.asx_ticker, tc.stock_ticker, tc.created_at,
          cp.domain, cp.logo_url, cp.industry, cp.description, cp.business_model, cp.offerings,
          cp.headquarters, cp.employee_count, cp.employee_growth, cp.founded_year, cp.competitive_position,
          cp.updated_at AS profile_updated_at
        FROM tracked_companies tc
        LEFT JOIN company_profiles cp ON cp.company_key = tc.company_key
        ORDER BY tc.created_at DESC
      `
      res.status(200).json(
        rows.map((row) => ({
          companyKey: row.company_key,
          companyName: row.company_name,
          status: row.status,
          isCompetitor: row.is_competitor,
          note: row.note,
          asxTicker: row.asx_ticker,
          stockTicker: row.stock_ticker,
          createdAt: row.created_at,
          domain: row.domain,
          logoUrl: row.logo_url,
          industry: row.industry,
          description: row.description,
          businessModel: row.business_model,
          offerings: row.offerings ?? [],
          competitivePosition: row.competitive_position,
          headquarters: row.headquarters,
          employeeCount: row.employee_count,
          employeeGrowth: row.employee_growth,
          foundedYear: row.founded_year,
          profileUpdatedAt: row.profile_updated_at,
        })),
      )
    } catch (err) {
      console.error("GET /api/companies failed:", err)
      res.status(500).json({ error: "Failed to load tracked companies" })
    }
    return
  }

  if (req.method === "POST") {
    const { companyKey, companyName, status, isCompetitor, note, asxTicker, stockTicker } = req.body ?? {}

    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey must be a non-empty string" })
      return
    }
    if (typeof companyName !== "string" || !companyName) {
      res.status(400).json({ error: "companyName must be a non-empty string" })
      return
    }
    if (status != null && status !== "customer" && status !== "prospect") {
      res.status(400).json({ error: "status must be 'customer', 'prospect', or null" })
      return
    }
    // Only used for the ASX-filings ingest source (api/_lib/fetchAsxFilings.js)
    // — not validated against a real ASX code list, just normalized to how
    // ASX tickers are actually written, so a stray lowercase/space typo
    // doesn't silently fail to match.
    const normalizedTicker = typeof asxTicker === "string" ? asxTicker.trim().toUpperCase() || null : null
    // Kept as its own field, not reused from asxTicker — Finnhub's symbol
    // for an ASX-listed stock is typically "NAB.AX", a different string
    // from the bare "NAB" the ASX filings source wants. See
    // db/migrations/008_add_market_data.sql.
    const normalizedStockTicker = typeof stockTicker === "string" ? stockTicker.trim().toUpperCase() || null : null

    try {
      await sql`
        INSERT INTO tracked_companies (company_key, company_name, status, is_competitor, note, asx_ticker, stock_ticker)
        VALUES (${companyKey}, ${companyName}, ${status ?? null}, ${Boolean(isCompetitor)}, ${note ?? null}, ${normalizedTicker}, ${normalizedStockTicker})
        ON CONFLICT (company_key)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          status = EXCLUDED.status,
          is_competitor = EXCLUDED.is_competitor,
          note = EXCLUDED.note,
          asx_ticker = EXCLUDED.asx_ticker,
          stock_ticker = EXCLUDED.stock_ticker
      `
      res.status(200).json({
        companyKey,
        companyName,
        status: status ?? null,
        isCompetitor: Boolean(isCompetitor),
        note: note ?? null,
        asxTicker: normalizedTicker,
        stockTicker: normalizedStockTicker,
      })
    } catch (err) {
      console.error("POST /api/companies failed:", err)
      res.status(500).json({ error: "Failed to save tracked company" })
    }
    // Company-snapshot enrichment is a separate request now
    // (api/company-profile.js), fired by the frontend right after this
    // one succeeds (useCompanies.js) — not run inline here. Confirmed
    // directly (real timed test calls, not assumed) that genuine
    // web-search research takes 35-50+ seconds even for a small company,
    // which was too tight a margin once it had to share Vercel's 60s
    // hard maxDuration with this route's own DB write and response. That
    // route gets the (near-)full 60s budget to itself instead.
    return
  }

  if (req.method === "DELETE") {
    const { companyKey } = req.body ?? {}
    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey must be a non-empty string" })
      return
    }
    try {
      await sql`DELETE FROM tracked_companies WHERE company_key = ${companyKey}`
      res.status(200).json({ companyKey, deleted: true })
    } catch (err) {
      console.error("DELETE /api/companies failed:", err)
      res.status(500).json({ error: "Failed to remove tracked company" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}
