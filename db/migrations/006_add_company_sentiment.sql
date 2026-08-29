-- Public-sentiment snapshots per company — "what people are saying"
-- (news, Reddit, social media), sourced by scripts/local/sync-sentiment.mjs
-- via the last30days + agent-reach skills. Append-only: one row per
-- research pass per company, same pattern as ingest_runs, so history is
-- kept rather than overwritten. api/sentiment.js reads the latest row per
-- company_key.
CREATE TABLE IF NOT EXISTS company_sentiment (
  id                 SERIAL PRIMARY KEY,
  company_key        TEXT NOT NULL,
  company_name       TEXT NOT NULL,

  overall_sentiment  TEXT NOT NULL CHECK (overall_sentiment IN ('positive', 'mixed', 'neutral', 'negative')),

  -- 2-4 sentence synthesis of the research pass.
  summary            TEXT NOT NULL,

  -- Plain JSON array of short strings, e.g. ["pricing complaints", "praised support"].
  themes             JSONB NOT NULL DEFAULT '[]',

  -- Array of {source: 'news'|'reddit'|'social'|'web', headline, url, date?} --
  -- the real, cited items the summary and themes were drawn from.
  evidence           JSONB NOT NULL DEFAULT '[]',

  researched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_sentiment_company_key_idx ON company_sentiment (company_key, researched_at DESC);
