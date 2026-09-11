import { coachAccount } from "./_lib/accountCoaching.js"
import { BudgetExceededError } from "./_lib/normalize.js"

// Deliberately stateless, same shape as api/account-chat.js — the
// frontend sends the org chart and MEDDPICC data it already has loaded
// rather than this route re-fetching from the database, so there's one
// source of truth for "what's currently in these two panels" (whatever
// MeddpiccPanel.jsx and OrgChartPanel.jsx last loaded).
export default async function handler(req, res) {
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
    console.error("account-coaching: failed for", companyName, err)
    res.status(500).json({ error: "Failed to get coaching" })
  }
}
