// Builds the prompt sent to `claude -p` for one company's hiring-signal
// research pass. Sibling of last30days-prompt.mjs — same idea (headless
// research, write structured JSON to a file, this repo's orchestrator
// pushes it to the database), different focus: real, checkable evidence
// that a company is growing its team, not general company news.
export function buildHiringSignalPrompt(companyName, outputPath) {
  return `Research real hiring / team-growth signals for the company "${companyName}" from roughly the last 30 days, for someone deciding whether this is worth a sales outreach touch.

If the "agent-reach" skill is available to you, use it to search relevant social platforms (LinkedIn especially, but also X/Twitter, Reddit, or company blogs) for real posts about this company growing its team. If it isn't available, or on top of it, use WebSearch directly for the same thing: LinkedIn posts about team expansion, press coverage of a hiring push, a new office or team stand-up, a "we're hiring" announcement with real substance (not just a generic evergreen careers page).

Also check job boards directly via WebSearch — Seek, Indeed, and Glassdoor — for a real, current volume of open roles at this company, or a notable pattern (e.g. many roles in one function or location opening at once). agent-reach has no dedicated connector for these three sites, so reach them through plain web search, not the agent-reach skill.

Only write up a finding when you have a real, checkable source — an actual URL you found, not a guess or a plausible-sounding one. If nothing genuinely new turned up for this company in that window, that's a valid outcome — write an empty array rather than forcing something weak.

Write a JSON array (and nothing else — no prose, no markdown fences) to the file at exactly this path: ${outputPath}

Each array item must have exactly these fields:
- "companyName": "${companyName}" (use this exact string)
- "headline": a short, specific headline for this one finding — not just the company name
- "scope": "micro" (this is always about one specific company)
- "signalType": "hiring surge"
- "summary": 2-3 sentences, written for someone deciding whether this is worth an outreach touch — what you found, then why it matters
- "sourceUrl": the real URL backing this specific finding
- "date": "YYYY-MM-DD" if determinable, otherwise omit this field entirely

If nothing genuinely relevant turned up, write an empty JSON array [] to the file rather than forcing a weak finding.

Use the Write tool to save the file. Do not print the JSON in your response — just confirm the file was written and how many findings it contains.`
}
