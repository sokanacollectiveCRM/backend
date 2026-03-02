-- Add assignment service selection support.
-- Stores selected service names for each client<->doula assignment row.

ALTER TABLE public.doula_assignments
ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_doula_assignments_services_gin
  ON public.doula_assignments
  USING gin (services);

COMMENT ON COLUMN public.doula_assignments.services IS
  'Service selections tied to this doula assignment (e.g. Labor Support, Postpartum Support).';
