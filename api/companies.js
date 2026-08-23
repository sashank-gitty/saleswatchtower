import { sql } from "./_lib/db.js"

// The tracked-companies list — the single thing this app asks you to set
// up. GET lists every company you're watching; POST adds or updates one;
// DELETE stops tracking one. The next /api/ingest run automatically picks
// up any change here — there's no separate "sync" step.
export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT company_key, company_name, status, is_competitor, note, created_at
        FROM tracked_companies
        ORDER BY created_at DESC
      `
      res.status(200).json(
        rows.map((row) => ({
          companyKey: row.company_key,
          companyName: row.company_name,
          status: row.status,
          isCompetitor: row.is_competitor,
          note: row.note,
          createdAt: row.created_at,
        })),
      )
    } catch (err) {
      console.error("GET /api/companies failed:", err)
      res.status(500).json({ error: "Failed to load tracked companies" })
    }
    return
  }

  if (req.method === "POST") {
    const { companyKey, companyName, status, isCompetitor, note } = req.body ?? {}

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

    try {
      await sql`
        INSERT INTO tracked_companies (company_key, company_name, status, is_competitor, note)
        VALUES (${companyKey}, ${companyName}, ${status ?? null}, ${Boolean(isCompetitor)}, ${note ?? null})
        ON CONFLICT (company_key)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          status = EXCLUDED.status,
          is_competitor = EXCLUDED.is_competitor,
          note = EXCLUDED.note
      `
      res.status(200).json({ companyKey, companyName, status: status ?? null, isCompetitor: Boolean(isCompetitor), note: note ?? null })
    } catch (err) {
      console.error("POST /api/companies failed:", err)
      res.status(500).json({ error: "Failed to save tracked company" })
    }
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
