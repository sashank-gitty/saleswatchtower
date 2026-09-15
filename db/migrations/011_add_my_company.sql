-- Your own company profile — the seed for "type in your company and the
-- dashboard adapts." Singleton table: singleton_key is always 'me', so
-- there's exactly one row, upserted via ON CONFLICT rather than tracked
-- by an app-chosen id. Reuses the same research pipeline as tracked
-- companies (api/_lib/companyProfile.js's researchCompanyProfile), just
-- pointed at your own company instead of one you're selling to.
CREATE TABLE IF NOT EXISTS my_company (
  singleton_key   TEXT PRIMARY KEY DEFAULT 'me' CHECK (singleton_key = 'me'),

  company_name    TEXT,
  domain          TEXT,
  logo_url        TEXT,
  industry        TEXT,
  -- What research found, verbatim — never shown as your voice, only as
  -- the starting point for value_prop below.
  description     TEXT,
  -- Seeded from description, then yours to rewrite in your own words.
  -- This is what personalizes outreach angles (signalInsights.js) — kept
  -- separate from description so a re-research never silently overwrites
  -- something you already edited.
  value_prop      TEXT,
  -- Real competitors research found, each {name, added} — "added" tracks
  -- whether you've already added it to your tracked list as a
  -- competitor (tracked_companies.is_competitor), so re-visiting this
  -- page doesn't re-prompt for ones you already actioned.
  competitors     JSONB NOT NULL DEFAULT '[]',
  source_urls     JSONB NOT NULL DEFAULT '[]',

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
