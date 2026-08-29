-- Two new ingest sources beyond news/community/seed:
-- 'filing' = real ASX company announcements (earnings/annual reports,
-- api/_lib/fetchAsxFilings.js), 'hiring_signal' = ZoomInfo/Lusha
-- headcount-growth data plus a scheduled Agent-Reach social scan
-- (api/_lib/fetchHiringSignals.js). Drop-then-add rather than a bare ALTER
-- so this file can run every time db/migrate.mjs runs, same as every other
-- migration here — there's no migration-state table, only idempotent SQL.
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_origin_check;
ALTER TABLE signals ADD CONSTRAINT signals_origin_check
  CHECK (origin IN ('seed', 'news', 'community', 'filing', 'hiring_signal'));

-- Optional ASX ticker (e.g. "CBA") per tracked company. Only set for
-- companies actually listed on the ASX; fetchAsxFilings.js skips any
-- company where this is null instead of treating it as an error.
ALTER TABLE tracked_companies ADD COLUMN IF NOT EXISTS asx_ticker TEXT;
