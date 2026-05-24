-- Home step fields from CRM POST /requestService/requestSubmission
-- Safe to re-run.

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS home_access TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS home_types TEXT[];

-- Optional legacy VARCHAR (not used on intake INSERT; staff UI may read via home_types).
ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS home_type TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS home_type_other TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS home_adults_count TEXT;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS home_youth_count TEXT;

COMMENT ON COLUMN public.phi_clients.home_types IS 'Multi-select home type labels from public intake (CRM checkboxes).';
COMMENT ON COLUMN public.phi_clients.home_adults_count IS 'Count of adults in home from intake (0, 1, 2, 3, 4, 5+).';
COMMENT ON COLUMN public.phi_clients.home_youth_count IS 'Count of youth in home from intake (0, 1, 2, 3, 4, 5+).';
