// Builds the prompt sent to `claude -p` for one entity's community-research
// pass. Kept as its own module (not inlined in the orchestrator) so it's
// easy to read, tune, and version independently — this prompt is the part
// most likely to need iteration once you see real output quality.
export function buildLast30DaysPrompt(entity, outputPath) {
  return `Run the last30days skill for the topic: "${entity}" — a company on a sales/outreach tracking dashboard.

After you have the research report, extract the 3 to 5 findings most relevant to someone deciding whether this is worth an outreach touch. Prioritize concrete events over generic commentary — leadership changes, funding, disclosed pain points, competitive moves, regulatory issues, customer complaints. Skip anything that's pure background noise with no real selling angle.

For each finding, use the REAL cited URL from the report (last30days output includes inline markdown links [name](url) per its own citation rules — extract the actual URL from those links, never invent or guess one). If a finding has no real citable URL, drop that finding rather than fabricating a source.

Write a JSON array (and nothing else — no prose, no markdown fences) to the file at exactly this path: ${outputPath}

Each array item must have exactly these fields:
- "entity": "${entity}" (use this exact string)
- "headline": a short, specific headline for this one finding — not just the entity name
- "scope": "macro" or "micro" — "micro" if specific to this entity, "macro" if it's broader market/industry context that surfaced while researching it
- "signalType": "community insight"
- "summary": 2-3 sentences, written for an SDR deciding whether this is worth an outreach touch — what happened, then why it matters
- "sourceUrl": the real cited URL for this specific finding
- "date": "YYYY-MM-DD" if determinable from the report, otherwise omit this field entirely

If nothing genuinely relevant turned up, write an empty JSON array [] to the file rather than forcing weak findings.

Use the Write tool to save the file. Do not print the JSON in your response — just confirm the file was written and how many findings it contains.`
}
