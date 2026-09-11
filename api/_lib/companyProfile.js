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
- "competitors": a JSON array of up to 5 real company names that genuinely compete with this one (real named companies you found evidence for, not a generic category). Empty array if you can't confirm any.
- "sourceUrls": a JSON array of the real URLs you actually drew this from.

Every field is optional except you must make a genuine effort to find each one. Omit a field entirely rather than guessing, inventing, or writing "unknown" — a missing field is honest, a made-up one is not. If you cannot find the company at all (name too generic, no real company matches), respond with exactly: {"notFound": true}

Use the search tool as many times as you need first. Once you're done searching, your VERY LAST message must contain the JSON object and nothing else — no lead-in sentence like "Now I have enough information" or "Here is the JSON", no closing remarks, no markdown fences. The JSON object should be the entire content of your final message.`

// Light-weight sibling to researchCompanyProfile() below: every account
// on the dashboard gets a real logo (not just tracked companies), but
// the only thing a logo needs is the company's domain — unavatar.io does
// the rest. Running the full 5-search, 35-50s research pipeline just for
// a domain would be slow and wasteful for the ~30 companies that pass
// through the feed without ever being tracked. This is a single short
// completion, no web-search tool, small max_tokens — seconds, not
// minutes. Shares the same budget guard as the full pipeline.
const DOMAIN_SYSTEM_PROMPT = `You are given a company name. Respond with ONLY a single JSON object (no prose, no markdown fences): {"domain": "example.com"} — the company's real primary website domain, no protocol or path. If you cannot confidently identify a real company matching this name, respond with exactly: {"domain": null}`

export async function researchCompanyDomain(companyName) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spend)
  }

  const response = await anthropic.messages.create(
    {
      model: "claude-sonnet-5",
      max_tokens: 200,
      system: DOMAIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Company name: ${companyName}` }],
    },
    { timeout: 15_000, maxRetries: 0 },
  )

  await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

  const textBlocks = response.content.filter((block) => block.type === "text")
  const rawText = textBlocks[textBlocks.length - 1]?.text?.trim() ?? ""
  if (!rawText) return null

  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  const text = start !== -1 && end !== -1 && end > start ? rawText.slice(start, end + 1) : rawText

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (typeof parsed.domain !== "string" || !parsed.domain) return null
  return { domain: parsed.domain, logoUrl: `https://unavatar.io/${parsed.domain}` }
}

export async function researchCompanyProfile(companyName) {
  const spend = await monthToDateSpend()
  if (spend >= MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spend)
  }

  // A 55s request timeout, under Vercel's 60s hard maxDuration for
  // api/company-profile.js (vercel.json — the Hobby-plan ceiling, not
  // raisable) with a small margin for the DB write and response either
  // side of this call. This route's only job is enrichment (split out
  // of api/companies.js after confirming, with real timed calls, that
  // research alone regularly takes 35-50+ seconds — too tight a margin
  // when it had to share the 60s budget with a second route's own DB
  // write and response), so it can afford to use nearly all of it. A
  // request-level timeout throws an ordinary error the caller already
  // handles, so the company still gets tracked with just no snapshot,
  // rather than losing the whole request including the response.
  const response = await anthropic.messages.create(
    {
      model: "claude-sonnet-5",
      // 1024 was too low — confirmed directly, not guessed: a real
      // Chevron request came back with stop_reason "max_tokens" and the
      // final JSON cut off mid-string ("...refining, and m"), which is
      // why it failed to parse. max_tokens caps this whole turn's
      // output, and for a company big enough to need several searches,
      // that budget covers each search's own short narration + the
      // tool_use block itself + the final JSON — 1024 wasn't enough
      // headroom for a company with a lot of real search-worthy
      // material. 4096 gives real room without being unbounded.
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Bounds real search cost/time per company — one company shouldn't
      // spiral into an open-ended research session.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: `Company name: ${companyName}` }],
    },
    // maxRetries: 0 is load-bearing, not an optimization — confirmed by
    // testing directly, not assumed. The SDK's default is 2 retries on a
    // timeout, so `timeout` alone doesn't mean "give up after N seconds":
    // it means "give up after N seconds, then try up to two more times."
    // At the default that would reach ~165s wall-clock — enough to blow
    // past Vercel's 60s hard maxDuration on its own even with the extra
    // room this route now has. One attempt, one real ceiling.
    { timeout: 55_000, maxRetries: 0 },
  )

  // Billed whether or not the completion turns out to be parseable, same
  // reasoning as normalize.js. Doesn't capture the web-search tool's own
  // small per-search fee (see api/_lib/companyProfile.js's plan notes) —
  // immaterial at the volume this runs at (once per newly tracked company).
  await recordSpend(response.usage.input_tokens, response.usage.output_tokens)

  // Detected directly against a real failure — log this distinctly from
  // a plain "didn't return valid JSON" below, since the fix is different
  // (raise max_tokens further) rather than a parsing/prompt problem.
  if (response.stop_reason === "max_tokens") {
    console.warn(`researchCompanyProfile: hit max_tokens for "${companyName}" — response was truncated`)
  }

  // Unlike normalize.js (a plain completion, no tools — realistically one
  // text block), a web-search turn can produce several text blocks: a
  // short narration before/between searches, then the real answer last.
  // Confirmed by a real failure — the model wrote "Now I have enough
  // information to compile the JSON response." as its own text block,
  // and taking the FIRST text block (normalize.js's pattern) grabbed
  // that instead of the JSON that followed. Take the LAST text block —
  // the model's actual final answer — and additionally slice out
  // whatever's between the first "{" and the last "}" in case that block
  // still carries a stray lead-in or trailing sentence around the JSON.
  const textBlocks = response.content.filter((block) => block.type === "text")
  const rawText = textBlocks[textBlocks.length - 1]?.text?.trim() ?? ""
  if (!rawText) {
    console.warn("researchCompanyProfile: no text in response for", companyName)
    return null
  }

  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  const text = start !== -1 && end !== -1 && end > start ? rawText.slice(start, end + 1) : rawText

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn("researchCompanyProfile: model did not return valid JSON:", rawText.slice(0, 200))
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
    competitors: Array.isArray(parsed.competitors) ? parsed.competitors.filter((c) => typeof c === "string").slice(0, 5) : [],
    sourceUrls: Array.isArray(parsed.sourceUrls) ? parsed.sourceUrls.filter((u) => typeof u === "string") : [],
  }
}
