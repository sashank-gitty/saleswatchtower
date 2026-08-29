import { sql } from "./_lib/db.js"
import { researchCompanyProfile } from "./_lib/companyProfile.js"
import { BudgetExceededError } from "./_lib/normalize.js"

// The tracked-companies list — the single thing this app asks you to set
// up. GET lists every company you're watching; POST adds or updates one;
// DELETE stops tracking one. The next /api/ingest run automatically picks
// up any change here — there's no separate "sync" step.
export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT
          tc.company_key, tc.company_name, tc.status, tc.is_competitor, tc.note, tc.asx_ticker, tc.created_at,
          cp.domain, cp.logo_url, cp.industry, cp.description, cp.business_model, cp.offerings,
          cp.headquarters, cp.employee_count, cp.employee_growth, cp.founded_year, cp.updated_at AS profile_updated_at
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
          createdAt: row.created_at,
          domain: row.domain,
          logoUrl: row.logo_url,
          industry: row.industry,
          description: row.description,
          businessModel: row.business_model,
          offerings: row.offerings ?? [],
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
    const { companyKey, companyName, status, isCompetitor, note, asxTicker } = req.body ?? {}

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

    try {
      await sql`
        INSERT INTO tracked_companies (company_key, company_name, status, is_competitor, note, asx_ticker)
        VALUES (${companyKey}, ${companyName}, ${status ?? null}, ${Boolean(isCompetitor)}, ${note ?? null}, ${normalizedTicker})
        ON CONFLICT (company_key)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          status = EXCLUDED.status,
          is_competitor = EXCLUDED.is_competitor,
          note = EXCLUDED.note,
          asx_ticker = EXCLUDED.asx_ticker
      `
    } catch (err) {
      console.error("POST /api/companies failed:", err)
      res.status(500).json({ error: "Failed to save tracked company" })
      return
    }

    // Best-effort company-snapshot enrichment — only for a company that
    // doesn't already have one (an edit to an existing tracked company's
    // note/status shouldn't re-spend on research it already has).
    //
    // Deliberately awaited BEFORE the response is sent, not after —
    // learned the hard way that "after" doesn't work here. A serverless
    // function on Vercel does not keep running once its response has
    // gone out; code placed after res.json() with no further await on
    // it landing anywhere durable can end up not running at all. So
    // tracking a company now genuinely waits on this (up to ~60s.
    // vercel.json's maxDuration for this route). The frontend already
    // updates optimistically and doesn't wait on this request resolving
    // (see useCompanies.js), so the extra time is invisible in the UI —
    // it's only this HTTP request itself that runs long, not anything
    // the user is staring at.
    //
    // Wrapped so a slow or failed enrichment (including hitting the
    // monthly budget) never fails the tracking action itself.
    try {
      const existing = await sql`SELECT 1 FROM company_profiles WHERE company_key = ${companyKey}`
      if (existing.length === 0) {
        const profile = await researchCompanyProfile(companyName)
        if (profile) {
          await sql`
            INSERT INTO company_profiles (
              company_key, company_name, domain, logo_url, industry, description, business_model,
              offerings, headquarters, employee_count, employee_growth, founded_year, source_urls
            )
            VALUES (
              ${companyKey}, ${companyName}, ${profile.domain}, ${profile.logoUrl}, ${profile.industry},
              ${profile.description}, ${profile.businessModel}, ${JSON.stringify(profile.offerings)},
              ${profile.headquarters}, ${profile.employeeCount}, ${profile.employeeGrowth}, ${profile.foundedYear},
              ${JSON.stringify(profile.sourceUrls)}
            )
            ON CONFLICT (company_key) DO NOTHING
          `
        }
      }
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        console.warn("companyProfile:", err.message)
      } else {
        console.error("companyProfile: enrichment failed for", companyName, err)
      }
    }

    res.status(200).json({
      companyKey,
      companyName,
      status: status ?? null,
      isCompetitor: Boolean(isCompetitor),
      note: note ?? null,
      asxTicker: normalizedTicker,
    })
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
