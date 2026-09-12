import { sql } from "./_lib/db.js"
import { researchCompanyProfile } from "./_lib/companyProfile.js"
import { BudgetExceededError } from "./_lib/normalize.js"

// Enriches one tracked company with a real snapshot (logo, industry, HQ,
// employee count/growth, ...) — split out of api/companies.js's POST
// handler after confirming directly, with real timed test calls against
// the live Anthropic API (not assumed from docs), that genuine
// web-search research takes 35-50+ seconds even for a small company like
// Airtasker. That was too tight a margin once it had to share Vercel's
// 60s hard maxDuration with the tracked_companies write and that
// route's own response — this route's only job is enrichment, so it
// gets nearly the full 60s window to itself.
//
// Called by the frontend right after a successful POST /api/companies
// (see useCompanies.js) — fired without the tracking flow waiting on it,
// so a slow or failed enrichment never blocks or fails the act of
// tracking a company. Idempotent: a company that already has a profile
// is a fast no-op, so calling this on every track (not just new ones) is
// safe and cheap.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const { companyKey, companyName } = req.body ?? {}
  if (typeof companyKey !== "string" || !companyKey || typeof companyName !== "string" || !companyName) {
    res.status(400).json({ error: "companyKey and companyName must be non-empty strings" })
    return
  }

  try {
    const existing = await sql`SELECT 1 FROM company_profiles WHERE company_key = ${companyKey}`
    if (existing.length > 0) {
      res.status(200).json({ skipped: "already-profiled" })
      return
    }

    const profile = await researchCompanyProfile(companyName)
    if (!profile) {
      res.status(200).json({ found: false })
      return
    }

    await sql`
      INSERT INTO company_profiles (
        company_key, company_name, domain, logo_url, industry, description, business_model,
        offerings, headquarters, employee_count, employee_growth, founded_year, competitive_position, source_urls
      )
      VALUES (
        ${companyKey}, ${companyName}, ${profile.domain}, ${profile.logoUrl}, ${profile.industry},
        ${profile.description}, ${profile.businessModel}, ${JSON.stringify(profile.offerings)},
        ${profile.headquarters}, ${profile.employeeCount}, ${profile.employeeGrowth}, ${profile.foundedYear},
        ${profile.competitivePosition}, ${JSON.stringify(profile.sourceUrls)}
      )
      ON CONFLICT (company_key) DO NOTHING
    `
    res.status(200).json({ found: true })
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.warn("companyProfile:", err.message)
      res.status(200).json({ skipped: "budget" })
      return
    }
    console.error("companyProfile: enrichment failed for", companyName, err)
    res.status(500).json({ error: "Enrichment failed" })
  }
}
