import { sql } from "./_lib/db.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    // to_char avoids the classic node-postgres DATE-to-local-midnight
    // timezone footgun — we want the exact YYYY-MM-DD stored, no shifting.
    // Note: @neondatabase/serverless's tagged-template `sql` resolves
    // directly to an array of rows, unlike @vercel/postgres's `{ rows }`.
    const rows = await sql`
      SELECT
        id,
        headline,
        summary,
        source_url AS "sourceUrl",
        to_char(date, 'YYYY-MM-DD') AS date,
        scope,
        entity,
        signal_type AS "signalType",
        origin,
        outreach_relevance AS "outreachRelevance",
        matched_companies AS "matchedCompanies",
        (reviewed_at IS NOT NULL) AS reviewed,
        created_at AS "createdAt"
      FROM signals
      ORDER BY date DESC, created_at DESC
    `

    // No edge caching here: "reviewed" state changes on every click and
    // needs to be fresh across devices — that's the whole point of moving
    // it off localStorage (Issue 4). This is a low-traffic personal tool,
    // so the DB load from skipping the cache is a non-issue.
    res.status(200).json(rows)
  } catch (err) {
    console.error("GET /api/signals failed:", err)
    res.status(500).json({ error: "Failed to load signals" })
  }
}
