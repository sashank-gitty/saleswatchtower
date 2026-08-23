import { sql } from "./_lib/db.js"

// Marks (or unmarks) a batch of signals reviewed. Deliberately one endpoint
// for both the single-row toggle and the bulk "Mark N Reviewed" action —
// both are just an array of ids. No auth: this app has no login system and
// is explicitly single-user, so anyone who can reach the frontend can
// reach this too, same trust boundary as everything else here.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const { ids, reviewed } = req.body ?? {}

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    res.status(400).json({ error: "ids must be a non-empty array of strings" })
    return
  }
  if (typeof reviewed !== "boolean") {
    res.status(400).json({ error: "reviewed must be a boolean" })
    return
  }

  try {
    const reviewedAt = reviewed ? new Date().toISOString() : null
    await sql`UPDATE signals SET reviewed_at = ${reviewedAt} WHERE id = ANY(${ids})`
    res.status(200).json({ updated: ids.length })
  } catch (err) {
    console.error("POST /api/reviews failed:", err)
    res.status(500).json({ error: "Failed to update review state" })
  }
}
