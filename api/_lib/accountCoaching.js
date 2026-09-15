import Anthropic from "@anthropic-ai/sdk"
import { MONTHLY_BUDGET_USD, monthToDateSpend, recordSpend } from "./budget.js"
import { BudgetExceededError } from "./normalize.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Reasons across the org chart and MEDDPICC state the rep has already
// entered — gaps in who's mapped, gaps in what's documented, and moves
// that connect the two (e.g. "you have a Champion but no confirmed
// Economic Buyer; X reports to Y, who might be it"). Grounded ONLY in
// the names/roles/text given: never invents a fact about the real
// account, never guesses at a real person's actual influence or intent
// beyond what the rep already wrote down.
const SYSTEM_PROMPT = `You are a sales deal coach. You're given one account's org chart (real people the rep has entered, with reporting lines and MEDDPICC role tags) and their MEDDPICC worksheet (8 pillars, each with the rep's own free-text reasoning).

Your job: point out concrete gaps and connections, using ONLY the names, roles, and reasoning given. Never invent a fact about the real company or a real person's actual role, influence, or intent beyond what's written. If something is genuinely missing, say so plainly rather than guessing at it.

Cover, briefly:
1. Which MEDDPICC roles (Economic Buyer, Champion, Coach) have no one tagged in the org chart yet
2. Any org chart person who looks like an obvious fit for an untagged role, based only on their given title/reporting line — flag it as "worth confirming," not a fact
3. Which MEDDPICC pillars are empty or thin
4. One concrete next action

4-6 sentences, plain prose, no markdown headers or bullet lists.`

export async function coachAccount({ companyName, orgChart, meddpicc }) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spend)
  }

  const orgChartText = orgChart.length
    ? orgChart
        .map((p) => {
          const manager = orgChart.find((m) => m.id === p.reportsToId)
          return `- ${p.fullName}${p.title ? ` (${p.title})` : ""}${p.meddpiccRole ? ` — tagged as ${p.meddpiccRole}` : " — no MEDDPICC role tagged"}${manager ? `, reports to ${manager.fullName}` : ""}`
        })
        .join("\n")
    : "(no one entered yet)"

  const meddpiccText = meddpicc
    .map((m) => `- ${m.pillar}: ${m.freeText?.trim() ? m.freeText.trim() : "(empty)"}`)
    .join("\n")

  const userContent = `Account: ${companyName}\n\nOrg chart:\n${orgChartText}\n\nMEDDPICC:\n${meddpiccText}`

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
  return text || "No coaching came back — try again."
}
