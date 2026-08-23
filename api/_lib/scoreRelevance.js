import Anthropic from "@anthropic-ai/sdk"
import { RELEVANCE_RUBRIC } from "../../shared/relevanceRubric.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You score outreach relevance for someone tracking a specific list of companies, with no information about what they sell. You'll be given an already-curated signal (entity, category, and summary are correct and fixed — do not second-guess them).

${RELEVANCE_RUBRIC}

Respond with ONLY a JSON object and nothing else: {"outreachRelevance": <integer 1-5>}`

// Scores an already-normalized signal against the shared rubric — used by
// the one-time backfill over historical rows that predate ingest-time
// scoring. Deliberately narrower than normalize.js: entity/scope/signalType
// are already correct here and shouldn't be re-derived, just scored.
export async function scoreRelevance({ headline, summary, entity, scope, signalType }) {
  const userContent = `Entity: ${entity}\nScope: ${scope}\nSignal type: ${signalType}\nHeadline: ${headline}\nSummary: ${summary}`

  // One retry: the occasional empty completion is transient, and a
  // dropped score here isn't recoverable later — the backfill's default
  // pass only revisits rows where the column is NULL, so a row that
  // failed while already holding a stale score would keep it silently.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 50,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    })

    const text = response.content.find((block) => block.type === "text")?.text?.trim() ?? ""
    if (!text) continue

    const relevance = parseScore(text)
    if (relevance !== null) return relevance

    console.warn(`scoreRelevance: unusable response (attempt ${attempt + 1}):`, text.slice(0, 120))
  }

  return null
}

// Accepts either shape the model might produce: the requested
// {"outreachRelevance": 4} or a bare 4. Both are unambiguous, and
// rejecting the second throws away a correct answer over formatting.
function parseScore(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  const raw = typeof parsed === "object" && parsed !== null ? parsed.outreachRelevance : parsed
  const relevance = Number(raw)
  return Number.isInteger(relevance) && relevance >= 1 && relevance <= 5 ? relevance : null
}
