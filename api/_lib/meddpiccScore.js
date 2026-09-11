import Anthropic from "@anthropic-ai/sdk"
import { MONTHLY_BUDGET_USD, monthToDateSpend, recordSpend } from "./budget.js"
import { BudgetExceededError } from "./normalize.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// What "strong" means for each pillar — without this, the model has no
// fixed bar to score against and the number drifts between calls. Kept
// short: one line each, not a rubric essay.
const PILLAR_GUIDANCE = {
  metrics: "A specific, quantified business outcome the buyer cares about — not a vague 'save time' or 'improve efficiency.'",
  economic_buyer: "A named person with actual budget authority, plus evidence of real access to them (not just their title).",
  decision_criteria: "The buyer's own stated criteria for choosing, ideally in their words — not the rep's assumption of what matters to them.",
  decision_process: "Concrete steps and a real timeline for how this account actually decides and signs — not a generic 'they'll evaluate it.'",
  paper_process: "The real procurement/legal/security steps and who owns each one — not just 'there's a contract process.'",
  identify_pain: "A specific, costed pain tied to a real business consequence — not a generic problem statement.",
  champion: "A named internal advocate with demonstrated willingness to sell internally on the rep's behalf, not just someone who took a meeting.",
  competition: "Named, specific competitive alternatives (including 'do nothing') and why this option wins against each — not a vague 'no direct competitor.'",
}

// Judges the STRENGTH of reasoning the rep already wrote for one
// MEDDPICC pillar — never invents a fact about the real account. The
// only source of truth here is the free text itself; a thin or vague
// answer scores low regardless of whether the underlying deal is
// actually healthy, because a low score on this pillar means exactly
// one thing: write down more of what you actually know.
const SYSTEM_PROMPT = `You are a sales methodology coach scoring one MEDDPICC pillar's written reasoning for strength — specificity, evidence, and named facts versus vague or generic statements.

Score 0-100:
- 0-20: empty or a placeholder ("TBD", "need to find out")
- 21-50: a vague or generic statement with no specifics
- 51-75: specific but missing a key detail (a name, a number, a date)
- 76-100: specific, named, evidenced — the kind of answer that would survive a deal review

Judge ONLY the text given. Never assume or invent anything about the real account beyond what's written. Respond with ONLY a single JSON object (no prose, no markdown fences): {"score": <integer 0-100>, "feedback": "<one sentence, specific to what's missing or what's strong>"}`

export async function scoreMeddpiccPillar({ pillar, freeText }) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spend)
  }

  const guidance = PILLAR_GUIDANCE[pillar] ?? "Specific, named, evidenced reasoning beats a vague general statement."
  const userContent = `Pillar: ${pillar}\nWhat "strong" looks like for this pillar: ${guidance}\n\nRep's written reasoning:\n${freeText.trim() || "(empty)"}`

  const response = await anthropic.messages.create(
    {
      model: "claude-sonnet-5",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    },
    { timeout: 20_000, maxRetries: 0 },
  )

  await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

  const rawText = response.content.find((block) => block.type === "text")?.text?.trim() ?? ""
  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  const text = start !== -1 && end !== -1 && end > start ? rawText.slice(start, end + 1) : rawText

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { score: null, feedback: "Couldn't score this — try again." }
  }

  const score = Number.isInteger(parsed.score) ? Math.max(0, Math.min(100, parsed.score)) : null
  const feedback = typeof parsed.feedback === "string" ? parsed.feedback : null
  return { score, feedback }
}
