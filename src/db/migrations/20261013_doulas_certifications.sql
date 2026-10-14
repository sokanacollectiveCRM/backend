-- DEV pilot: additive and safe to run repeatedly. No existing profile data is replaced.
ALTER TABLE public.doulas
  ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_submitted_at timestamptz;
COMMENT ON COLUMN public.doulas.certifications IS 'Structured certification name, issuingOrganization, and year; validated by the profile API.';
COMMENT ON COLUMN public.doulas.profile_submitted_at IS 'First submission for admin review; subsequent profile edits preserve this timestamp.';
-- Older pilot notice schemas lack tenant ownership. New profile notices always set it.
ALTER TABLE IF EXISTS public.dashboard_notices
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
