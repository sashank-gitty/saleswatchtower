-- Org Chart: manually-entered people per account (real LinkedIn/contact
-- integration is a later step — see api/_lib/companyProfile.js's own
-- "manual for now" pattern for logos/domains). Deliberately separate
-- from account_contacts (migration 009): that table is strictly
-- provider-verified (Lusha/ZoomInfo, CHECK'd source), and blending
-- manually-typed guesses into it would undercut the honesty guarantee
-- its own comment describes. This table is the opposite kind of data on
-- purpose — your own working notes on who's who at an account, not a
-- claim about verified real-world facts.
CREATE TABLE IF NOT EXISTS org_chart_contacts (
  id             SERIAL PRIMARY KEY,
  -- Not FK-restricted to tracked_companies, same as company_profiles —
  -- you might sketch out an org chart before formally tracking a company.
  company_key    TEXT NOT NULL,

  full_name      TEXT NOT NULL,
  title          TEXT,
  -- Self-referencing: builds the reporting-line tree. ON DELETE SET NULL
  -- so removing a manager doesn't cascade-delete their whole team.
  reports_to_id  INTEGER REFERENCES org_chart_contacts (id) ON DELETE SET NULL,
  meddpicc_role  TEXT CHECK (
    meddpicc_role IS NULL OR meddpicc_role IN ('economic_buyer', 'champion', 'coach', 'blocker', 'decision_maker', 'user', 'other')
  ),
  notes          TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_chart_contacts_company_idx ON org_chart_contacts (company_key);

-- MEDDPICC: one row per account per pillar (8 real MEDDPICC letters —
-- Metrics, Economic buyer, Decision criteria, Decision process, Paper
-- process, Identify pain, Champion, Competition). free_text is the
-- rep's own reasoning; checklist_done is a manual "I've nailed this"
-- flag; ai_score/ai_feedback are filled in on demand (api/meddpicc-score.js)
-- by asking Claude to judge the STRENGTH of the free_text the rep
-- already wrote — never to invent facts about the real account.
CREATE TABLE IF NOT EXISTS meddpicc_entries (
  company_key     TEXT NOT NULL,
  pillar          TEXT NOT NULL CHECK (
    pillar IN ('metrics', 'economic_buyer', 'decision_criteria', 'decision_process', 'paper_process', 'identify_pain', 'champion', 'competition')
  ),

  free_text       TEXT NOT NULL DEFAULT '',
  checklist_done  BOOLEAN NOT NULL DEFAULT false,
  ai_score        INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_feedback     TEXT,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (company_key, pillar)
);
