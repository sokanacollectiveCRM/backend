-- Referral intake + CRM (public.phi_clients)
-- Safe to re-run: adds columns only if missing.

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS referral_name TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS referral_email TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS referral_source_other TEXT;

COMMENT ON COLUMN public.phi_clients.referral_source IS 'Categorical intake source (CRM-aligned enum).';
COMMENT ON COLUMN public.phi_clients.referral_source_other IS 'Free text when referral_source is Other; cleared when source is not Other.';
