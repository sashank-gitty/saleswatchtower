import { sql } from "./_lib/db.js"

// The 8 real MEDDPICC pillars, in the order the acronym reads —
// Metrics, Economic buyer, Decision criteria, Decision process, Paper
// process, Identify pain, Champion, Competition. Shared with
// MeddpiccPanel.jsx's PILLARS so the two can't drift; kept here too
// since this route validates against it independent of what the
// frontend sends.
export const PILLARS = [
  "metrics",
  "economic_buyer",
  "decision_criteria",
  "decision_process",
  "paper_process",
  "identify_pain",
  "champion",
  "competition",
]
const PILLAR_SET = new Set(PILLARS)

function toWire(row) {
  return {
    companyKey: row.company_key,
    pillar: row.pillar,
    freeText: row.free_text,
    checklistDone: row.checklist_done,
    aiScore: row.ai_score,
    aiFeedback: row.ai_feedback,
    updatedAt: row.updated_at,
  }
}

// GET returns only the pillars that actually have a row — a freshly
// tracked account has none yet, and the frontend fills the other slots
// with empty defaults rather than this route pre-seeding 8 blank rows
// per account it's never asked to.
export default async function handler(req, res) {
  if (req.method === "GET") {
    const companyKey = req.query?.companyKey
    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey query param is required" })
      return
    }
    try {
      const rows = await sql`SELECT * FROM meddpicc_entries WHERE company_key = ${companyKey}`
      res.status(200).json(rows.map(toWire))
    } catch (err) {
      console.error("GET /api/meddpicc failed:", err)
      res.status(500).json({ error: "Failed to load MEDDPICC" })
    }
    return
  }

  if (req.method === "PUT") {
    const { companyKey, pillar, freeText, checklistDone } = req.body ?? {}

    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey must be a non-empty string" })
      return
    }
    if (!PILLAR_SET.has(pillar)) {
      res.status(400).json({ error: `pillar must be one of: ${PILLARS.join(", ")}` })
      return
    }

    try {
      // ai_score/ai_feedback reset to null: they judged the free_text
      // that's about to be replaced, so a stale score sitting next to
      // freshly-edited reasoning would be actively misleading. Re-score
      // via POST /api/meddpicc-score once the new text is ready.
      const rows = await sql`
        INSERT INTO meddpicc_entries (company_key, pillar, free_text, checklist_done)
        VALUES (${companyKey}, ${pillar}, ${freeText ?? ""}, ${Boolean(checklistDone)})
        ON CONFLICT (company_key, pillar)
        DO UPDATE SET
          free_text = EXCLUDED.free_text,
          checklist_done = EXCLUDED.checklist_done,
          ai_score = NULL,
          ai_feedback = NULL,
          updated_at = now()
        RETURNING *
      `
      res.status(200).json(toWire(rows[0]))
    } catch (err) {
      console.error("PUT /api/meddpicc failed:", err)
      res.status(500).json({ error: "Failed to save MEDDPICC entry" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}
