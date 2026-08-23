-- Tracked companies: the single list that drives everything. Typing a
-- company name into the dashboard and saving it here (via api/companies.js)
-- is the entire "setup" this app requires — the next ingest run
-- automatically starts searching the news for it, matching signals to it,
-- and scoring them.
--
-- This one table replaces three separate ideas from the old
-- single-employer version of this dashboard: the imported territory book
-- (an account list from someone else's spreadsheets), the hardcoded
-- competitor list, and the "claim an account" bookmark. There's no
-- meaningful difference between them for a tool one person runs for
-- themselves — it's all just "companies I want the news pipeline to
-- watch and show me."
--
-- company_key is the normalized form of the name (see accountKey() in
-- src/lib/accountModel.js and normalizeCompanyName() in
-- api/_lib/matchCompanies.js — the two must agree), so a company survives
-- being re-typed with slightly different capitalization or punctuation.
CREATE TABLE IF NOT EXISTS tracked_companies (
  company_key   TEXT PRIMARY KEY,
  company_name  TEXT NOT NULL,

  -- Optional. "customer" = you already have a relationship worth
  -- protecting/expanding; "prospect" = net-new. Null means not set.
  status        TEXT CHECK (status IN ('customer', 'prospect')),

  -- A competitor is tracked for positioning intelligence, not outreach —
  -- nobody cold-calls a competitor. Signals naming a competitor are kept
  -- out of the regular account list and shown on the Competitors page
  -- instead (see src/lib/competitorModel.js).
  is_competitor BOOLEAN NOT NULL DEFAULT FALSE,

  -- Freeform: why you're tracking this one, what you'd sell them, etc.
  -- Fed into the AI's "why does this matter" write-up when present.
  note          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracked_companies_competitor_idx ON tracked_companies (is_competitor);
