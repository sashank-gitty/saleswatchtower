import { sql } from "./_lib/db.js"

// Latest public-sentiment snapshot per company — see db/migrations/006 and
// scripts/local/sync-sentiment.mjs, which is what actually populates this
// table (a local script, not a serverless route: it needs the last30days
// and agent-reach skills, which only run inside a live Claude session).
// This route is read-only and sits behind the dashboard's normal Basic
// auth like every other read route, since it's read by the browser, not
// an unattended script.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    // DISTINCT ON keeps only the newest row per company_key — company_sentiment
    // is append-only, so a company researched multiple times has multiple rows.
    const rows = await sql`
      SELECT DISTINCT ON (company_key)
        company_key AS "companyKey",
        company_name AS "companyName",
        overall_sentiment AS "overallSentiment",
        summary,
        themes,
        evidence,
        researched_at AS "researchedAt"
      FROM company_sentiment
      ORDER BY company_key, researched_at DESC
    `
    res.status(200).json(rows)
  } catch (err) {
    console.error("GET /api/sentiment failed:", err)
    res.status(500).json({ error: "Failed to load sentiment" })
  }
}
