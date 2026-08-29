-- Buying-group contacts for a tracked company — real people, pulled via a
-- B2B contact-data provider (Lusha/ZoomInfo), not inferred or guessed.
-- The Contacts tab on an account page reads this table directly; when a
-- company has no rows here yet, that tab correctly shows its existing
-- "not available from this pipeline" empty state rather than anything
-- fabricated. Populated by a one-off lookup today (see api/account-contacts.js
-- for how a row gets written); nothing in the automated daily ingest cron
-- touches this table yet.
CREATE TABLE IF NOT EXISTS account_contacts (
  id            SERIAL PRIMARY KEY,
  company_key   TEXT NOT NULL REFERENCES tracked_companies (company_key) ON DELETE CASCADE,

  full_name     TEXT NOT NULL,
  title         TEXT,
  email         TEXT,
  linkedin_url  TEXT,

  -- Which provider this came from, so the UI can credit it and a repeat
  -- lookup can tell a stale row from a fresh one.
  source        TEXT NOT NULL CHECK (source IN ('lusha', 'zoominfo')),
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_contacts_company_idx ON account_contacts (company_key);
