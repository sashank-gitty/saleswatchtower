-- Real market data (price, market cap, next earnings date) via Finnhub —
-- api/_lib/fetchMarketData.js, wired into the daily ingest run alongside
-- fetchAsxFilings.js. Current-state, not a discrete event, so this is its
-- own upserted table like company_profiles, not a row in signals.

-- Kept separate from tracked_companies.asx_ticker on purpose: Finnhub's
-- symbol format for an ASX-listed stock is typically "NAB.AX", not the
-- bare "NAB" the ASX filings source (api/_lib/fetchAsxFilings.js) wants —
-- conflating the two fields would mean one of the two sources silently
-- gets the wrong value for the same company.
ALTER TABLE tracked_companies ADD COLUMN IF NOT EXISTS stock_ticker TEXT;

CREATE TABLE IF NOT EXISTS company_market_data (
  company_key        TEXT PRIMARY KEY,
  company_name        TEXT NOT NULL,
  ticker               TEXT NOT NULL,
  exchange             TEXT,
  price                NUMERIC,
  price_change_pct     NUMERIC,
  market_cap           NUMERIC,
  next_earnings_date   DATE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
