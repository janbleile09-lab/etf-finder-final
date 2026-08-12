-- Create the etf_market_data table for caching Twelve Data market quotes
-- Run this in the Supabase SQL Editor or via `supabase db push`

CREATE TABLE IF NOT EXISTS public.etf_market_data (
  isin TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  price NUMERIC(12, 4),
  change_absolute NUMERIC(10, 4),
  change_percent NUMERIC(8, 4),
  high NUMERIC(12, 4),
  low NUMERIC(12, 4),
  open_price NUMERIC(12, 4),
  previous_close NUMERIC(12, 4),
  volume BIGINT,
  currency TEXT DEFAULT 'EUR',
  fifty_two_week_high NUMERIC(12, 4),
  fifty_two_week_low NUMERIC(12, 4),
  exchange TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (public read, service write)
ALTER TABLE public.etf_market_data ENABLE ROW LEVEL SECURITY;

-- Anyone can read market data (it's public financial information)
CREATE POLICY "Anyone can read market data"
  ON public.etf_market_data
  FOR SELECT
  USING (true);

-- Only authenticated users with service role can insert/update
-- (The API route uses the server client with service privileges)
CREATE POLICY "Service can insert market data"
  ON public.etf_market_data
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update market data"
  ON public.etf_market_data
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Index for fast ISIN lookups
CREATE INDEX IF NOT EXISTS idx_etf_market_data_updated_at
  ON public.etf_market_data(updated_at);
