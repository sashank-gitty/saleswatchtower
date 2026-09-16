import Anthropic from "@anthropic-ai/sdk"
import { MONTHLY_BUDGET_USD, monthToDateSpend, recordSpend } from "./budget.js"
import { BudgetExceededError } from "./normalize.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You help a salesperson understand a prospect from their real LinkedIn profile data. Given a person's title, current company, experience, and about section, respond with ONLY a single JSON object (no prose, no markdown fences):
- "vertical": the closest functional/industry vertical this role sits in (e.g. "IT Security Leadership", "Revenue Operations", "Supply Chain").
- "roleSummary": 2-3 sentences on what this role actually entails day-to-day, grounded in the real title/experience given — not a generic job description.
- "kpis": a JSON array of 3-5 short strings naming what someone in this role is likely measured on.
- "focus": a JSON array of 2-4 short strings naming what this person is likely prioritizing right now, given their real background.
- "outreachAngle": 1 sentence on what a vendor could credibly open a conversation with, given this specific person's real role and background — no generic filler.

Ground every field in the real profile data given — do not invent experience, achievements, or priorities not supported by it.`

export async function researchRole(profile) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) throw new BudgetExceededError(spend)

  const userContent = `Name: ${profile.name ?? "unknown"}\nCurrent title: ${profile.position ?? profile.title ?? "unknown"}\nCompany: ${profile.company_name ?? "unknown"}\nAbout: ${profile.about ?? "(none)"}\nExperience: ${JSON.stringify(profile.experience ?? []).slice(0, 2000)}`

  const response = await anthropic.messages.create(
    {
      model: "claude-sonnet-5",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    },
    { timeout: 20_000, maxRetries: 0 },
  )
  await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

  const text = response.content.find((b) => b.type === "text")?.text?.trim() ?? ""
  if (!text) return null

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  const jsonText = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return null
  }

  if (!parsed.vertical || !parsed.roleSummary) return null

  return {
    vertical: parsed.vertical,
    roleSummary: parsed.roleSummary,
    kpis: Array.isArray(parsed.kpis) ? parsed.kpis.filter((k) => typeof k === "string") : [],
    focus: Array.isArray(parsed.focus) ? parsed.focus.filter((f) => typeof f === "string") : [],
    outreachAngle: typeof parsed.outreachAngle === "string" ? parsed.outreachAngle : null,
  }
}
