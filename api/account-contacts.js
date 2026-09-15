import { sql } from "./_lib/db.js"

// Real buying-group contacts per company (db/migrations/009, widened by
// 013 to allow Apollo as a source too — no Lusha/ZoomInfo subscription on
// hand). Populated by POST below, run from a live session with the Apollo
// connector attached; there is still no automated daily ingest for this,
// only an on-demand pull per company.
const VALID_SOURCES = new Set(["lusha", "zoominfo", "apollo"])

export default async function handler(req, res) {
  if (req.method === "GET") {
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
    return
  }

  // Replaces this company's contacts from this specific provider only —
  // re-running a pull updates its own rows without touching contacts
  // fetched from a different provider (e.g. Airtasker's existing ZoomInfo
  // rows survive an Apollo pull for a different company).
  if (req.method === "POST") {
    const { companyKey, source, contacts } = req.body ?? {}
    if (typeof companyKey !== "string" || !companyKey.trim()) {
      res.status(400).json({ error: "companyKey must be a non-empty string" })
      return
    }
    if (!VALID_SOURCES.has(source)) {
      res.status(400).json({ error: `source must be one of: ${[...VALID_SOURCES].join(", ")}` })
      return
    }
    if (!Array.isArray(contacts) || contacts.some((c) => typeof c?.fullName !== "string" || !c.fullName.trim())) {
      res.status(400).json({ error: "contacts must be an array of objects with a non-empty fullName" })
      return
    }

    try {
      await sql`DELETE FROM account_contacts WHERE company_key = ${companyKey} AND source = ${source}`
      for (const c of contacts) {
        await sql`
          INSERT INTO account_contacts (company_key, full_name, title, email, linkedin_url, source)
          VALUES (${companyKey}, ${c.fullName.trim()}, ${c.title ?? null}, ${c.email ?? null}, ${c.linkedinUrl ?? null}, ${source})
        `
      }
      const rows = await sql`
        SELECT
          company_key AS "companyKey", full_name AS "fullName", title, email,
          linkedin_url AS "linkedinUrl", source, fetched_at AS "fetchedAt"
        FROM account_contacts WHERE company_key = ${companyKey} ORDER BY full_name
      `
      res.status(200).json(rows)
    } catch (err) {
      console.error("POST /api/account-contacts failed for", companyKey, err)
      res.status(500).json({ error: "Failed to save contacts" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}
