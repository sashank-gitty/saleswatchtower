import Anthropic from "@anthropic-ai/sdk"
import { SIGNAL_TYPES, SCOPES, REGIONS } from "../../shared/signalTypes.js"
import { RELEVANCE_RUBRIC } from "../../shared/relevanceRubric.js"
import { MONTHLY_BUDGET_USD, monthToDateSpend, recordSpend } from "./budget.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Thrown instead of calling the API once month-to-date spend has reached
// the cap. Distinct from a normal "skip" (off-topic item) so ingest.js can
// stop the run instead of just moving on to the next item.
export class BudgetExceededError extends Error {
  constructor(spend) {
    super(`Monthly Claude API budget of $${MONTHLY_BUDGET_USD} reached ($${spend.toFixed(2)} spent this month) — skipping further normalization until next month.`)
    this.name = "BudgetExceededError"
  }
}

const SYSTEM_PROMPT = `You extract structured sales-intelligence signals from news for someone tracking a specific list of companies they might sell to, partner with, or compete against. You have no information about what they sell — judge relevance to "would a salesperson tracking this company want to know about this," not to any specific product or industry.

Given a raw news headline + snippet, output ONLY a single JSON object (no prose, no markdown fences) with these fields:
- "entity": the single company, organization, or market this is about. Use the real proper name (e.g. "Commonwealth Bank of Australia", not "CBA" or "the bank").
- "scope": "${SCOPES[0]}" for broad market/economic/regulatory context with no single company at the center, "${SCOPES[1]}" for something specific to one named company or organization.
- "signalType": prefer one of exactly these labels when it genuinely fits: ${SIGNAL_TYPES.map((t) => `"${t}"`).join(", ")}. Only invent a new short label if none of these fit at all. Use "new entrant" for a company entering a new market or region it wasn't previously operating in. Set "scope" to "micro" for these: they are about one named company, even when the company is unfamiliar or headquartered elsewhere.
- "summary": 2-3 sentences, written for someone deciding whether this is worth an outreach touch — state what happened, then why it matters for someone who might sell to, partner with, or compete against this company. Match a professional analyst tone. Do not fabricate details not present in the source text.
- "outreachRelevance": integer 1-5. ${RELEVANCE_RUBRIC}
- "regionRelevance": one of ${REGIONS.map((r) => `"${r}"`).join(", ")}. This dashboard's user is in Australia/New Zealand (ANZ). Use "anz" when the story is specifically about ANZ operations, leadership, market entry, or regulation. Use "global" when it matters regardless of region — major M&A, a top-level (global CEO/CFO) leadership change, a funding round, company-wide earnings. Use "other" when the story is tied to a specific region other than ANZ with no clear ANZ angle (e.g. a UK-only leadership appointment, a US-only regulatory action).

If the input is too thin, purely local human-interest news with no business angle, or you cannot confidently identify a single entity, respond with exactly: {"skip": true}

One exception worth stating outright, because it is easy to skip by mistake: never skip a story about a company entering a new country or region it wasn't previously operating in. These are high-value signals — a company standing up a new local operation is hiring a local team, launching to local customers, and has no incumbent vendor relationship there yet. Being unfamiliar is what makes it valuable, not what makes it marginal.`

export async function normalizeItem({ title, snippet, matchedQuery }) {
  const userContent = `Headline: ${title}\nSnippet: ${snippet || "(none)"}\nMatched watchlist query: ${matchedQuery}`

  // One retry on an empty or unparseable completion, same as
  // scoreRelevance. This runs on the daily cron, where a dropped item
  // is a signal that silently never reaches the feed.
  let parsed = null
  for (let attempt = 0; attempt < 2 && parsed === null; attempt += 1) {
    // Checked before every call (including the retry attempt) rather than
    // once per item, so a run that crosses the cap mid-item still stops.
    const spend = await monthToDateSpend()
    if (spend >= MONTHLY_BUDGET_USD) {
      throw new BudgetExceededError(spend)
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    })
    // Record real usage regardless of what comes next — the call is
    // billed whether or not the completion turns out to be parseable.
    await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

    const text = response.content.find((block) => block.type === "text")?.text?.trim() ?? ""
    if (!text) continue

    try {
      parsed = JSON.parse(text)
    } catch {
      console.warn(
        `normalizeItem: model did not return valid JSON (attempt ${attempt + 1}):`,
        text.slice(0, 200),
      )
    }
  }

  if (parsed === null) {
    console.warn("normalizeItem: no usable response after retry, skipping")
    return null
  }

  if (parsed.skip) return null

  const relevance = Number(parsed.outreachRelevance)
  if (
    !parsed.entity ||
    !SCOPES.includes(parsed.scope) ||
    !parsed.signalType ||
    !parsed.summary ||
    !Number.isInteger(relevance) ||
    relevance < 1 ||
    relevance > 5
  ) {
    console.warn("normalizeItem: incomplete fields, skipping:", parsed)
    return null
  }

  // Not required the way the fields above are — an unrecognized or
  // missing region shouldn't drop an otherwise-good signal, it just
  // means this one won't be filterable by region (falls back to "global"
  // treatment: shown everywhere, like the pre-region-tagging rows).
  const regionRelevance = REGIONS.includes(parsed.regionRelevance) ? parsed.regionRelevance : null

  return { ...parsed, outreachRelevance: relevance, regionRelevance }
}
