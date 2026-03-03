-- Add missing profile fields to Cloud SQL doulas table for profile tab parity.
-- Safe to run multiple times.

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS zip_code text;

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS account_status text;

UPDATE public.doulas
SET account_status = 'approved'
WHERE account_status IS NULL OR btrim(account_status) = '';

ALTER TABLE public.doulas
ALTER COLUMN account_status SET DEFAULT 'approved';

ALTER TABLE public.doulas
ALTER COLUMN account_status SET NOT NULL;
