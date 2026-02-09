-- Add address-related columns to client_info if missing (schema cache fix for profile update)
-- Run in Supabase SQL Editor or your migration pipeline. After running, Supabase may need a moment to refresh schema cache.

ALTER TABLE public.client_info
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT;
