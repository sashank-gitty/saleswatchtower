import { sql } from "./db.js"

// Hard ceiling on Claude API spend from the ingest normalizer, calendar
// month to date. Priced against Sonnet's standing list rate ($3/$15 per
// MTok), not the introductory rate ($2/$10 through 2026-08-31) — pricing
// conservatively means the cap still holds once the intro period ends,
// rather than quietly letting real spend run past $10.
export const MONTHLY_BUDGET_USD = 10
const INPUT_PRICE_PER_MTOK = 3.0
const OUTPUT_PRICE_PER_MTOK = 15.0

function costFor(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK
}

// Sum of llm_spend since the start of the current calendar month (UTC,
// via Postgres' date_trunc — matches occurred_at's TIMESTAMPTZ storage).
export async function monthToDateSpend() {
  const rows = await sql`
    SELECT COALESCE(SUM(cost_usd), 0) AS total
    FROM llm_spend
    WHERE occurred_at >= date_trunc('month', now())
  `
  return Number(rows[0].total)
}

// Call immediately after every Claude API response, successful or not —
// a call is billed whether or not the completion parses.
export async function recordSpend(inputTokens, outputTokens) {
  const cost = costFor(inputTokens, outputTokens)
  await sql`
    INSERT INTO llm_spend (input_tokens, output_tokens, cost_usd)
    VALUES (${inputTokens}, ${outputTokens}, ${cost})
  `
  return cost
}
