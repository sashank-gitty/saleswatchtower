-- Cached LinkedIn role research per contact (api/account-contacts.js's
-- resource=role-research). Keyed by linkedin_url rather than
-- account_contacts.id on purpose: a re-pull from a provider (see
-- account_contacts' DELETE-then-INSERT-per-source pattern) issues fresh
-- SERIAL ids, which would silently orphan any brief keyed to the old id.
-- linkedin_url is the real, stable identity of the person and is also
-- the literal input to the Bright Data lookup.
CREATE TABLE IF NOT EXISTS contact_role_briefs (
  linkedin_url   TEXT PRIMARY KEY,

  -- pending: Bright Data job submitted, not yet ready.
  -- ready: brief is populated and safe to show.
  -- error: Bright Data or the reasoning step failed; error_message set.
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'error')),
  snapshot_id    TEXT,
  brief          JSONB,
  error_message  TEXT,

  fetched_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
