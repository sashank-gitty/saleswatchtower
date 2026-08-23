-- Core signal feed. One row per news item the ingest pipeline collected
-- and an LLM judged worth an SDR's attention.
CREATE TABLE IF NOT EXISTS signals (
  id             TEXT PRIMARY KEY,
  headline       TEXT NOT NULL,
  summary        TEXT NOT NULL,
  source_url     TEXT NOT NULL,
  date           DATE NOT NULL,
  scope          TEXT NOT NULL CHECK (scope IN ('macro', 'micro')),
  entity         TEXT NOT NULL,
  signal_type    TEXT NOT NULL,

  -- Where this row came from. 'news' = the RSS/news ingest pipeline,
  -- 'community' = last30days-derived signals (see scripts/local/README.md),
  -- 'seed' reserved for a one-time import of hand-written example data.
  origin         TEXT NOT NULL DEFAULT 'news' CHECK (origin IN ('seed', 'news', 'community')),

  -- Dedupe key so re-running ingestion against the same article is a
  -- no-op instead of a duplicate row. Normalized source URL by default;
  -- ingestion can fall back to a content hash when a feed reuses URLs.
  dedupe_key     TEXT NOT NULL UNIQUE,

  -- 1-5, how strongly this justifies an outreach touch (shared/relevanceRubric.js).
  -- Nullable: a row can exist briefly before scoring finishes.
  outreach_relevance SMALLINT CHECK (outreach_relevance BETWEEN 1 AND 5),

  -- Durable "mark reviewed" state. No separate reviews table — this app
  -- has no auth and is single-user, so a nullable timestamp is enough.
  reviewed_at    TIMESTAMPTZ,

  -- Which of your tracked companies (see tracked_companies table) this
  -- signal names, resolved deterministically by api/_lib/matchCompanies.js.
  -- Empty for macro/thematic signals that name no company you're tracking.
  matched_companies TEXT[] NOT NULL DEFAULT '{}',

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signals_date_idx ON signals (date DESC);
CREATE INDEX IF NOT EXISTS signals_entity_idx ON signals (entity);
CREATE INDEX IF NOT EXISTS signals_scope_idx ON signals (scope);
CREATE INDEX IF NOT EXISTS signals_signal_type_idx ON signals (signal_type);
CREATE INDEX IF NOT EXISTS signals_relevance_idx ON signals (outreach_relevance DESC);
CREATE INDEX IF NOT EXISTS signals_matched_companies_idx ON signals USING GIN (matched_companies);
