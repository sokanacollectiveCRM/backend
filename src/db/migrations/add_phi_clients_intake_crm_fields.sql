-- Persist full CRM /requestService/requestSubmission payload fields on public.phi_clients
-- (city/state/zip already exist on many instances; other columns added if missing.)
-- Safe to re-run.

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS birth_location TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS birth_hospital TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS provider_type TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS pronouns TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS pronouns_other TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS preferred_name TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS pets TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS service_support_details TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS services_interested TEXT[];

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS intake_age_years INTEGER;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS primary_language TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS children_expected TEXT;

COMMENT ON COLUMN public.phi_clients.intake_age_years IS 'Client-reported age in years from public intake (CRM); distinct from client_age_range buckets.';
COMMENT ON COLUMN public.phi_clients.services_interested IS 'Service labels from intake multi-select (TEXT[]).';
COMMENT ON COLUMN public.phi_clients.service_support_details IS 'Free-text support details from intake step 0.';
