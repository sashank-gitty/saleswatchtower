import { sql } from "./_lib/db.js"

// Every company_profiles row with a logo_url — tracked companies (full
// profile) and untracked/discovery companies (light, domain-only row —
// see researchCompanyDomain() in api/_lib/companyProfile.js and the
// backfill step in api/ingest.js) alike. Read-only, same fetch-everything
// shape as api/sentiment.js: the frontend fetches this once and looks up
// client-side rather than querying per account.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const rows = await sql`
      SELECT company_key AS "companyKey", logo_url AS "logoUrl"
      FROM company_profiles
      WHERE logo_url IS NOT NULL
    `
    res.status(200).json(rows)
  } catch (err) {
    console.error("GET /api/company-logos failed:", err)
    res.status(500).json({ error: "Failed to load logos" })
  }
}
