import Anthropic from "@anthropic-ai/sdk"
import { MONTHLY_BUDGET_USD, monthToDateSpend, recordSpend } from "./budget.js"
import { BudgetExceededError } from "./normalize.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Real company research via Claude's hosted web-search tool
// (web_search_20260209) — Anthropic's own servers run the searches, so
// this is a normal messages.create call, not an agentic loop: the search
// results come back as content blocks in the same response, and Claude
// keeps generating until it reaches a final text block. No MCP, no
// second vendor API key — this app already calls the Anthropic API (see
// normalize.js) and already has ANTHROPIC_API_KEY.
const SYSTEM_PROMPT = `You research real companies for a sales-intelligence dashboard, building a factual snapshot from real web sources.

Search the web for the real company named in the request, then respond with ONLY a single JSON object (no prose, no markdown fences) with these fields:
- "domain": the company's real primary website domain (e.g. "stripe.com"), no protocol or path. Omit (do not include the key) if you can't confirm a real domain.
- "industry": a short industry label (e.g. "Cybersecurity", "Cloud accounting software").
- "description": 1-2 sentences on what the company actually does.
- "businessModel": 1 sentence on how they make money (e.g. "subscription SaaS", "usage-based API pricing", "marketplace commission").
- "offerings": a JSON array of short strings naming their key products or services (e.g. ["Vulnerability scanning", "Cloud security posture management"]). Empty array if you can't confirm any.
- "headquarters": city and country/state, e.g. "Sydney, Australia". Omit if unknown.
- "employeeCount": a headcount figure or range as a short string, e.g. "1,001-5,000" or "~450". Omit if unknown.
- "employeeGrowth": one short phrase on hiring/growth trend if you find real evidence of it (e.g. "actively hiring — 20+ open roles"). Omit if you find nothing concrete — never guess a trend.
- "foundedYear": integer year founded. Omit if unknown.
- "sourceUrls": a JSON array of the real URLs you actually drew this from.

Every field is optional except you must make a genuine effort to find each one. Omit a field entirely rather than guessing, inventing, or writing "unknown" — a missing field is honest, a made-up one is not. If you cannot find the company at all (name too generic, no real company matches), respond with exactly: {"notFound": true}`

export async function researchCompanyProfile(companyName) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spend)
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    // Bounds real search cost/time per company — one company shouldn't
    // spiral into an open-ended research session.
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: `Company name: ${companyName}` }],
  })

  // Billed whether or not the completion turns out to be parseable, same
  // reasoning as normalize.js. Doesn't capture the web-search tool's own
  // small per-search fee (see api/_lib/companyProfile.js's plan notes) —
  // immaterial at the volume this runs at (once per newly tracked company).
  await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

  const text = response.content.find((block) => block.type === "text")?.text?.trim() ?? ""
  if (!text) {
    console.warn("researchCompanyProfile: no text in response for", companyName)
    return null
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn("researchCompanyProfile: model did not return valid JSON:", text.slice(0, 200))
    return null
  }

  if (parsed.notFound) return null

  return {
    domain: typeof parsed.domain === "string" ? parsed.domain : null,
    logoUrl: typeof parsed.domain === "string" ? `https://unavatar.io/${parsed.domain}` : null,
    industry: typeof parsed.industry === "string" ? parsed.industry : null,
    description: typeof parsed.description === "string" ? parsed.description : null,
    businessModel: typeof parsed.businessModel === "string" ? parsed.businessModel : null,
    offerings: Array.isArray(parsed.offerings) ? parsed.offerings.filter((o) => typeof o === "string") : [],
    headquarters: typeof parsed.headquarters === "string" ? parsed.headquarters : null,
    employeeCount: typeof parsed.employeeCount === "string" ? parsed.employeeCount : null,
    employeeGrowth: typeof parsed.employeeGrowth === "string" ? parsed.employeeGrowth : null,
    foundedYear: Number.isInteger(parsed.foundedYear) ? parsed.foundedYear : null,
    sourceUrls: Array.isArray(parsed.sourceUrls) ? parsed.sourceUrls.filter((u) => typeof u === "string") : [],
  }
}
