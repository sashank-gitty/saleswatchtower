-- Company firmographic snapshot — logo, what they do, how they make money,
-- HQ, employee count/growth — fetched via api/_lib/companyProfile.js (a
-- real Claude API call with the hosted web-search tool) when a company is
-- first tracked. Current-state, not history: one row per company,
-- upserted, unlike company_sentiment's append-only research log.
CREATE TABLE IF NOT EXISTS company_profiles (
  company_key      TEXT PRIMARY KEY,
  company_name     TEXT NOT NULL,

  -- From real search results, not guessed from the company name — also
  -- what builds logo_url (unavatar.io/{domain}).
  domain           TEXT,
  logo_url         TEXT,

  industry         TEXT,
  description      TEXT,        -- what they do, 1-2 sentences
  business_model   TEXT,        -- how they make money, 1 sentence
  offerings        JSONB NOT NULL DEFAULT '[]',  -- short strings: key products/services

  headquarters     TEXT,
  -- Text, not int: real sources give ranges ("201-500 employees") as
  -- often as an exact number.
  employee_count   TEXT,
  employee_growth  TEXT,
  founded_year     INTEGER,

  source_urls      JSONB NOT NULL DEFAULT '[]',  -- the real pages this was drawn from
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
