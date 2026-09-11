// Org Chart, MEDDPICC, MEDDPICC AI-scoring, and account AI-coaching —
// four logically separate resources, ONE file. Vercel's Hobby plan caps
// a deployment at 12 Serverless Functions and counts by FILE under
// api/, not by what's inside it; these were four separate files until
// that limit was hit for real (see the commit this file lands in).
// Dispatched by ?resource=org-chart|meddpicc|meddpicc-score|coaching.
import { sql } from "./_lib/db.js"
import { scoreMeddpiccPillar } from "./_lib/meddpiccScore.js"
import { coachAccount } from "./_lib/accountCoaching.js"
import { BudgetExceededError } from "./_lib/normalize.js"

const MEDDPICC_ROLES = new Set(["economic_buyer", "champion", "coach", "blocker", "decision_maker", "user", "other"])

// The 8 real MEDDPICC pillars, in the order the acronym reads.
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
const MAX_TEXT_LENGTH = 2000

// ---------------------------------------------------------------------
// Org Chart

function orgChartToWire(row) {
  return {
    id: row.id,
    companyKey: row.company_key,
    fullName: row.full_name,
    title: row.title,
    reportsToId: row.reports_to_id,
    meddpiccRole: row.meddpicc_role,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function handleOrgChart(req, res) {
  if (req.method === "GET") {
    const companyKey = req.query?.companyKey
    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey query param is required" })
      return
    }
    try {
      const rows = await sql`
        SELECT * FROM org_chart_contacts WHERE company_key = ${companyKey} ORDER BY created_at ASC
      `
      res.status(200).json(rows.map(orgChartToWire))
    } catch (err) {
      console.error("GET org-chart failed:", err)
      res.status(500).json({ error: "Failed to load org chart" })
    }
    return
  }

  if (req.method === "POST") {
    const { companyKey, fullName, title, reportsToId, meddpiccRole, notes } = req.body ?? {}

    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey must be a non-empty string" })
      return
    }
    if (typeof fullName !== "string" || !fullName.trim()) {
      res.status(400).json({ error: "fullName must be a non-empty string" })
      return
    }
    if (meddpiccRole != null && !MEDDPICC_ROLES.has(meddpiccRole)) {
      res.status(400).json({ error: `meddpiccRole must be one of: ${[...MEDDPICC_ROLES].join(", ")}` })
      return
    }

    try {
      const rows = await sql`
        INSERT INTO org_chart_contacts (company_key, full_name, title, reports_to_id, meddpicc_role, notes)
        VALUES (${companyKey}, ${fullName.trim()}, ${title ?? null}, ${reportsToId ?? null}, ${meddpiccRole ?? null}, ${notes ?? null})
        RETURNING *
      `
      res.status(201).json(orgChartToWire(rows[0]))
    } catch (err) {
      console.error("POST org-chart failed:", err)
      res.status(500).json({ error: "Failed to add person" })
    }
    return
  }

  if (req.method === "PATCH") {
    const { id, fullName, title, reportsToId, meddpiccRole, notes } = req.body ?? {}

    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "id must be an integer" })
      return
    }
    if (typeof fullName !== "string" || !fullName.trim()) {
      res.status(400).json({ error: "fullName must be a non-empty string" })
      return
    }
    if (meddpiccRole != null && !MEDDPICC_ROLES.has(meddpiccRole)) {
      res.status(400).json({ error: `meddpiccRole must be one of: ${[...MEDDPICC_ROLES].join(", ")}` })
      return
    }
    if (reportsToId === id) {
      res.status(400).json({ error: "A person cannot report to themselves" })
      return
    }

    try {
      const rows = await sql`
        UPDATE org_chart_contacts
        SET full_name = ${fullName.trim()},
            title = ${title ?? null},
            reports_to_id = ${reportsToId ?? null},
            meddpicc_role = ${meddpiccRole ?? null},
            notes = ${notes ?? null},
            updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `
      if (rows.length === 0) {
        res.status(404).json({ error: "Person not found" })
        return
      }
      res.status(200).json(orgChartToWire(rows[0]))
    } catch (err) {
      console.error("PATCH org-chart failed:", err)
      res.status(500).json({ error: "Failed to update person" })
    }
    return
  }

  if (req.method === "DELETE") {
    const id = Number(req.query?.id)
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "id query param must be an integer" })
      return
    }
    try {
      await sql`DELETE FROM org_chart_contacts WHERE id = ${id}`
      res.status(204).end()
    } catch (err) {
      console.error("DELETE org-chart failed:", err)
      res.status(500).json({ error: "Failed to remove person" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}

// ---------------------------------------------------------------------
// MEDDPICC (save/read)

function meddpiccToWire(row) {
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

async function handleMeddpicc(req, res) {
  if (req.method === "GET") {
    const companyKey = req.query?.companyKey
    if (typeof companyKey !== "string" || !companyKey) {
      res.status(400).json({ error: "companyKey query param is required" })
      return
    }
    try {
      const rows = await sql`SELECT * FROM meddpicc_entries WHERE company_key = ${companyKey}`
      res.status(200).json(rows.map(meddpiccToWire))
    } catch (err) {
      console.error("GET meddpicc failed:", err)
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
      res.status(200).json(meddpiccToWire(rows[0]))
    } catch (err) {
      console.error("PUT meddpicc failed:", err)
      res.status(500).json({ error: "Failed to save MEDDPICC entry" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}

// ---------------------------------------------------------------------
// MEDDPICC AI scoring

async function handleMeddpiccScore(req, res) {
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
    console.error("meddpicc-score failed for", companyKey, pillar, err)
    res.status(500).json({ error: "Failed to score this pillar" })
  }
}

// ---------------------------------------------------------------------
// Account AI coaching (org chart + MEDDPICC, reasoned across together)

async function handleCoaching(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const { companyName, orgChart, meddpicc } = req.body ?? {}

  if (typeof companyName !== "string" || !companyName) {
    res.status(400).json({ error: "companyName must be a non-empty string" })
    return
  }
  if (!Array.isArray(orgChart) || !Array.isArray(meddpicc)) {
    res.status(400).json({ error: "orgChart and meddpicc must be arrays" })
    return
  }

  const cleanOrgChart = orgChart.map((p) => ({
    id: p?.id,
    fullName: String(p?.fullName ?? ""),
    title: p?.title ? String(p.title) : null,
    reportsToId: p?.reportsToId ?? null,
    meddpiccRole: p?.meddpiccRole ?? null,
  }))
  const cleanMeddpicc = meddpicc.map((m) => ({
    pillar: String(m?.pillar ?? ""),
    freeText: String(m?.freeText ?? ""),
  }))

  try {
    const coaching = await coachAccount({ companyName, orgChart: cleanOrgChart, meddpicc: cleanMeddpicc })
    res.status(200).json({ coaching })
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      res.status(200).json({ coaching: null, budgetExceeded: true, message: err.message })
      return
    }
    console.error("account-coaching failed for", companyName, err)
    res.status(500).json({ error: "Failed to get coaching" })
  }
}

// ---------------------------------------------------------------------

export default async function handler(req, res) {
  switch (req.query?.resource) {
    case "org-chart":
      return handleOrgChart(req, res)
    case "meddpicc":
      return handleMeddpicc(req, res)
    case "meddpicc-score":
      return handleMeddpiccScore(req, res)
    case "coaching":
      return handleCoaching(req, res)
    default:
      res.status(400).json({ error: "resource query param must be one of: org-chart, meddpicc, meddpicc-score, coaching" })
  }
}
