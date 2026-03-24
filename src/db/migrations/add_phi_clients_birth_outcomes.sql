-- Free-text narrative for birth summary (doula-entered). Stored on phi_clients.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'birth_outcomes'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN birth_outcomes text;
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.birth_outcomes IS 'Narrative birth outcomes summary (delivery type, complications, interventions, birth weight, etc.).';
