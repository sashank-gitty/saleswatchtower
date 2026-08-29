// Builds the prompt sent to `claude -p` for one company's public-sentiment
// research pass. Sibling of hiring-signal-prompt.mjs / last30days-prompt.mjs
// — same idea (headless research, write structured JSON to a file, this
// repo's orchestrator pushes it to the database) — but combines two
// skills into one synthesized read rather than a list of discrete
// findings: last30days for general news/analyst coverage, agent-reach for
// Reddit/social-platform chatter.
export function buildSentimentPrompt(companyKey, companyName, outputPath) {
  return `Research public sentiment on the company "${companyName}" from roughly the last 30 days — a holistic read of what people are actually saying, for someone deciding how to approach this account.

Use BOTH of these, combined into one picture:
- If the "last30days" skill is available, run it for "${companyName}" to get general news coverage and analyst/market commentary. If it isn't available, use WebSearch for the same thing.
- If the "agent-reach" skill is available, use it to search Reddit specifically (and other social platforms — X/Twitter, LinkedIn, etc.) for real posts and discussion about this company. If it isn't available, use WebSearch/WebFetch aimed at Reddit and social platforms for the same thing.

Only use real, checkable sources — an actual URL you found, never a guess or a plausible-sounding one. If you genuinely find nothing worth reporting, that's a valid outcome (see the empty-evidence note below), not a reason to invent something.

Synthesize what you found into ONE JSON object (and nothing else — no prose, no markdown fences), written to the file at exactly this path: ${outputPath}

The object must have exactly these fields:
- "companyKey": "${companyKey}" (use this exact string, unchanged)
- "companyName": "${companyName}" (use this exact string, unchanged)
- "overallSentiment": one of exactly "positive", "mixed", "neutral", "negative" — your honest read across everything you found, not just the most recent item
- "summary": 2-4 sentences synthesizing the overall picture — what people are saying and why, not a list of individual items
- "themes": a JSON array of short strings, the recurring topics/threads you actually saw (e.g. "praised for customer support", "pricing complaints", "buzz around a recent product launch"). Empty array if nothing rose to the level of a real theme.
- "evidence": a JSON array of the real items you drew on, each an object with "source" (one of "news", "reddit", "social", "web"), "headline" (short description of this one item), "url" (the real URL), and optionally "date" ("YYYY-MM-DD", omit if unknown). Empty array if you found nothing citable.

If you found real evidence but it's thin, still report honestly — "mixed" or "neutral" with a short summary and low evidence count is a valid, useful result. Do not inflate confidence or invent extra evidence to make the picture feel more complete than it is.

Use the Write tool to save the file. Do not print the JSON in your response — just confirm the file was written and give a one-line summary of the overall read.`
}
