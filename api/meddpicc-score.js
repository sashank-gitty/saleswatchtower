import { sql } from "./_lib/db.js"
import { scoreMeddpiccPillar } from "./_lib/meddpiccScore.js"
import { PILLARS } from "./meddpicc.js"
import { BudgetExceededError } from "./_lib/normalize.js"

const PILLAR_SET = new Set(PILLARS)
const MAX_TEXT_LENGTH = 2000

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const { companyKey, pillar, freeText } = req.body ?? {}

  if (typeof companyKey !== "string" || !companyKey) {
    res.status(400).json({ error: "companyKey must be a non-empty string" })
    return
  }
  if (!PILLAR_SET.has(pillar)) {
    res.status(400).json({ error: `pillar must be one of: ${PILLARS.join(", ")}` })
    return
  }
  if (typeof freeText !== "string" || !freeText.trim()) {
    res.status(400).json({ error: "freeText must be a non-empty string" })
    return
  }
  if (freeText.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `freeText must be under ${MAX_TEXT_LENGTH} characters` })
    return
  }

  try {
    const { score, feedback } = await scoreMeddpiccPillar({ pillar, freeText })

    // Persisted here rather than requiring a separate PUT — a score is
    // only ever produced against the free_text that's already saved
    // (MeddpiccPanel.jsx saves on blur before offering the "Score this"
    // button), so this route is the one place ai_score gets written.
    const rows = await sql`
      UPDATE meddpicc_entries
      SET ai_score = ${score}, ai_feedback = ${feedback}, updated_at = now()
      WHERE company_key = ${companyKey} AND pillar = ${pillar}
      RETURNING ai_score, ai_feedback
    `
    if (rows.length === 0) {
      res.status(404).json({ error: "No saved entry for this pillar yet — save it first" })
      return
    }
    res.status(200).json({ score: rows[0].ai_score, feedback: rows[0].ai_feedback })
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      res.status(200).json({ score: null, feedback: null, budgetExceeded: true, message: err.message })
      return
    }
    console.error("meddpicc-score: failed for", companyKey, pillar, err)
    res.status(500).json({ error: "Failed to score this pillar" })
  }
}
