-- One row per /api/ingest invocation, success or failure, so the
-- frontend can show "last synced" without inferring it from
-- signals.created_at (which stays unchanged on a run that found nothing
-- new, making a healthy quiet day indistinguishable from a dead cron).
CREATE TABLE IF NOT EXISTS ingest_runs (
  id            SERIAL PRIMARY KEY,
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('success', 'error')),
  summary       JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS ingest_runs_run_at_idx ON ingest_runs (run_at DESC);
