-- Add bio field to Cloud SQL doulas profile table.
-- Safe to run multiple times.

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS bio text;
-- Add bio support for doula profile updates in Cloud SQL.
ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS bio TEXT;
