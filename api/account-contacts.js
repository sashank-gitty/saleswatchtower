import { sql } from "./_lib/db.js"

// Real buying-group contacts per company (db/migrations/009), pulled via a
// B2B contact-data provider (Lusha/ZoomInfo) and written to
// account_contacts directly — there is no automated ingest for this yet,
// only a one-off lookup done from a live session with those connectors
// attached. Read-only, same shape as api/sentiment.js: fetch everything
// once, look up client-side.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const rows = await sql`
      SELECT
        company_key AS "companyKey",
        full_name AS "fullName",
        title,
        email,
        linkedin_url AS "linkedinUrl",
        source,
        fetched_at AS "fetchedAt"
      FROM account_contacts
      ORDER BY company_key, full_name
    `
    res.status(200).json(rows)
  } catch (err) {
    console.error("GET /api/account-contacts failed:", err)
    res.status(500).json({ error: "Failed to load contacts" })
  }
}
