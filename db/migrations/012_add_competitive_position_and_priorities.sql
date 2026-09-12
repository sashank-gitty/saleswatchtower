-- Competitive position: how a tracked company measures up against its
-- named competitors, from the same research pass as description/
-- businessModel/offerings (api/_lib/companyProfile.js). Omitted by the
-- model when it can't find real evidence, same honesty rule as every
-- other field on this table.
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS competitive_position TEXT;

-- Strategic priorities: what leadership/C-suite actually wants from the
-- org right now (revenue growth, retention, cost discipline, etc.) —
-- this is never researched, only typed in by you (Settings' "My
-- Company" section), since it's internal direction no public source
-- could ever surface. Feeds the account-page angle suggestions.
ALTER TABLE my_company ADD COLUMN IF NOT EXISTS strategic_priorities TEXT;
