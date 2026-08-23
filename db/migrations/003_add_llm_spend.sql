-- Ledger of Claude API spend from the ingest normalizer, one row per call
-- (including retries — each is a separate billed request). Backs the hard
-- monthly budget guardrail in api/_lib/budget.js: normalizeItem checks
-- month-to-date spend before every call and refuses to place it once the
-- cap is reached, so the cap holds regardless of cron frequency, watchlist
-- size, or how many runs happen in a day.
CREATE TABLE IF NOT EXISTS llm_spend (
  id            SERIAL PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd      NUMERIC(10, 6) NOT NULL
);

CREATE INDEX IF NOT EXISTS llm_spend_occurred_at_idx ON llm_spend (occurred_at DESC);
