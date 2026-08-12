-- Create the user_saved_etfs table for bookmarking ETFs
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.user_saved_etfs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, isin)
);

-- Enable Row Level Security
ALTER TABLE public.user_saved_etfs ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own saved ETFs
CREATE POLICY "Users can read own saved ETFs"
  ON public.user_saved_etfs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own saved ETFs
CREATE POLICY "Users can insert own saved ETFs"
  ON public.user_saved_etfs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own saved ETFs
CREATE POLICY "Users can delete own saved ETFs"
  ON public.user_saved_etfs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_saved_etfs_user_id
  ON public.user_saved_etfs(user_id);
