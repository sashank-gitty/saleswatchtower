-- Per-signal region tag, set by the same normalize.js AI call that already
-- classifies entity/scope/signalType (no extra API cost). Nullable on
-- purpose: existing rows stay untagged and keep showing in the feed
-- (NULL is treated as "show" everywhere this is filtered) rather than a
-- mass backfill. Only new signals from this point on get tagged.
ALTER TABLE signals ADD COLUMN region_relevance TEXT CHECK (region_relevance IN ('anz', 'global', 'other'));
