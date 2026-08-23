import { RELEVANCE_RUBRIC } from "../../shared/relevanceRubric.js"

const TIER_PATTERN = /^([1-5]) — (.+)$/gm

function parseTiers() {
  const tiers = new Map()
  for (const match of RELEVANCE_RUBRIC.matchAll(TIER_PATTERN)) {
    tiers.set(Number(match[1]), match[2].trim())
  }
  return tiers
}

const TIERS = parseTiers()

// Reads the same rubric the ingest pipeline scores against (shared/
// relevanceRubric.js) so the detail view's "why this scored a N"
// explanation can't drift from what actually produced the score. This
// only reads that constant — it doesn't change ingest-time behavior.
export function relevanceTierText(score) {
  return TIERS.get(score) ?? null
}
