import Anthropic from "@anthropic-ai/sdk"
import { MONTHLY_BUDGET_USD, monthToDateSpend, recordSpend } from "./budget.js"
import { BudgetExceededError } from "./normalize.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Answers a free-text question about one account, grounded ONLY in that
// account's own signals — real headline/summary/date/source per signal,
// nothing else. Deliberately no web-search tool: this is "what do I
// already know about this account," not a new research call, which also
// means it stays fast and cheap — none of the timeout/max_tokens
// problems this session found building companyProfile.js (a
// web-search-driven call that regularly took 35-50+ seconds) apply
// here, since there's no tool call that can run long.
const SYSTEM_PROMPT = `You answer questions about a specific company for someone deciding whether and how to reach out to them, using ONLY the signals provided below as your source of truth.

Never use outside knowledge, and never invent or guess a fact that isn't in these signals. If the signals genuinely don't contain the answer, say so plainly — "I don't see anything about that in the tracked signals for this account" is a correct, useful answer; a guess dressed up as fact is not.

Answer in 2-4 sentences of plain prose. No markdown formatting, no headers, no bullet points unless the question specifically asks for a list.`

export async function answerAccountQuestion({ companyName, signals, question }) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spend)
  }

  const signalContext = signals
    .map((s, i) => `${i + 1}. [${s.date}] (${s.signalType}) ${s.headline}\n   ${s.summary}\n   Source: ${s.sourceUrl}`)
    .join("\n\n")

  const userContent = `Company: ${companyName}\n\nKnown signals:\n${signalContext || "(no signals on record for this account)"}\n\nQuestion: ${question}`

  // No tools, so — unlike companyProfile.js's web-search-driven call —
  // the model's first (and only) text block IS the answer, same as
  // normalize.js's plain-completion pattern. maxRetries: 0 + a real
  // timeout regardless: cheap insurance this session already learned is
  // worth having on every real API call, not just the slow ones.
  const response = await anthropic.messages.create(
    {
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    },
    { timeout: 30_000, maxRetries: 0 },
  )

  await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

  const text = response.content.find((block) => block.type === "text")?.text?.trim() ?? ""
  return text || "No answer came back — try rephrasing the question."
}
