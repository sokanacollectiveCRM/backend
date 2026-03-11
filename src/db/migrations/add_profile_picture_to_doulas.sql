-- Add profile_picture (headshot) to Cloud SQL doulas table.
-- Safe to run multiple times.

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS profile_picture TEXT;
