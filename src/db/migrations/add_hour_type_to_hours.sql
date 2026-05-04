-- Add hour category/type to Cloud SQL hours table.
-- Existing rows remain nullable so historical records continue to load as Unknown.

ALTER TABLE public.hours
  ADD COLUMN IF NOT EXISTS type text;

ALTER TABLE public.hours
  DROP CONSTRAINT IF EXISTS hours_type_check;

ALTER TABLE public.hours
  ADD CONSTRAINT hours_type_check
  CHECK (type IS NULL OR type IN ('prenatal', 'postpartum'));
