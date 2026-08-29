import { answerAccountQuestion } from "./_lib/accountChat.js"
import { BudgetExceededError } from "./_lib/normalize.js"

// Deliberately stateless — no chat history table, no memory of prior
// questions. Each request stands alone. The frontend sends the
// account's own already-derived signal list in the body rather than
// this route re-deriving "which signals belong to this company" from
// the database — matchCompanies.js's own comments are explicit that
// entity-matching is meant to have exactly one implementation, and
// duplicating that logic into a second server-side path here would
// undercut that on purpose.
const MAX_SIGNALS = 40
const MAX_QUESTION_LENGTH = 500

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const { companyName, signals, question } = req.body ?? {}

  if (typeof companyName !== "string" || !companyName) {
    res.status(400).json({ error: "companyName must be a non-empty string" })
    return
  }
  if (typeof question !== "string" || !question.trim()) {
    res.status(400).json({ error: "question must be a non-empty string" })
    return
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    res.status(400).json({ error: `question must be under ${MAX_QUESTION_LENGTH} characters` })
    return
  }
  if (!Array.isArray(signals)) {
    res.status(400).json({ error: "signals must be an array" })
    return
  }

  // Trust nothing about the payload's shape beyond what's needed here —
  // the frontend only ever sends these fields (see AccountChat.jsx), but
  // a malformed or oversized body shouldn't reach the Anthropic call.
  const cleanSignals = signals.slice(0, MAX_SIGNALS).map((s) => ({
    date: String(s?.date ?? ""),
    signalType: String(s?.signalType ?? ""),
    headline: String(s?.headline ?? ""),
    summary: String(s?.summary ?? ""),
    sourceUrl: String(s?.sourceUrl ?? ""),
  }))

  try {
    const answer = await answerAccountQuestion({ companyName, signals: cleanSignals, question: question.trim() })
    res.status(200).json({ answer })
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      res.status(200).json({ answer: null, budgetExceeded: true, message: err.message })
      return
    }
    console.error("account-chat: failed for", companyName, err)
    res.status(500).json({ error: "Failed to answer question" })
  }
}
