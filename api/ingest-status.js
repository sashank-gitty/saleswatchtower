import { sql } from "./_lib/db.js"

// Lets the frontend show "last synced" without inferring it from
// signals.created_at, which doesn't move on a run that found nothing new.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const rows = await sql`
      SELECT run_at AS "runAt", status, summary, error_message AS "errorMessage"
      FROM ingest_runs
      ORDER BY run_at DESC
      LIMIT 1
    `
    res.status(200).json(rows[0] ?? null)
  } catch (err) {
    console.error("GET /api/ingest-status failed:", err)
    res.status(500).json({ error: "Failed to load ingest status" })
  }
}
