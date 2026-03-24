-- Doula profile demographics (Cloud SQL public.doulas)
-- Run against Cloud SQL when deploying doula demographic fields.

ALTER TABLE public.doulas
  ADD COLUMN IF NOT EXISTS gender VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pronouns VARCHAR(100),
  ADD COLUMN IF NOT EXISTS race_ethnicity TEXT[],
  ADD COLUMN IF NOT EXISTS race_ethnicity_other TEXT,
  ADD COLUMN IF NOT EXISTS other_demographic_details TEXT;

COMMENT ON COLUMN public.doulas.race_ethnicity IS 'Multi-select race/ethnicity option keys (aligned with CRM doula profile UI).';
COMMENT ON COLUMN public.doulas.race_ethnicity_other IS 'Free text when "another_race_ethnicity" is selected.';
