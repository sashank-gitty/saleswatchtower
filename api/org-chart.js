import { sql } from "./_lib/db.js"

const MEDDPICC_ROLES = new Set(["economic_buyer", "champion", "coach", "blocker", "decision_maker", "user", "other"])

function toWire(row) {
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

// Manually-entered org chart, per account — GET lists everyone for a
// company, POST adds a person, PATCH edits one, DELETE removes one.
// Real LinkedIn/contact-provider integration is a later step; this is
// the rep's own working notes on who's who, not a verified-fact table
// (see db/migrations/010's comment for why this is a separate table
// from account_contacts rather than reusing it).
export default async function handler(req, res) {
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
      res.status(200).json(rows.map(toWire))
    } catch (err) {
      console.error("GET /api/org-chart failed:", err)
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
      res.status(201).json(toWire(rows[0]))
    } catch (err) {
      console.error("POST /api/org-chart failed:", err)
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
    // A person can't report to themselves — the one integrity check
    // worth doing here rather than leaving a silent self-loop in the tree.
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
      res.status(200).json(toWire(rows[0]))
    } catch (err) {
      console.error("PATCH /api/org-chart failed:", err)
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
      console.error("DELETE /api/org-chart failed:", err)
      res.status(500).json({ error: "Failed to remove person" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}
