-- Structured Birth Outcomes fields (reportable).
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'birth_outcomes_induction'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN birth_outcomes_induction boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'birth_outcomes_delivery_type'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN birth_outcomes_delivery_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'birth_outcomes_medications_used'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN birth_outcomes_medications_used text[];
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.birth_outcomes_induction IS 'Structured birth outcome: induction (true/false).';
COMMENT ON COLUMN public.phi_clients.birth_outcomes_delivery_type IS 'Structured birth outcome: delivery type (enum-like text).';
COMMENT ON COLUMN public.phi_clients.birth_outcomes_medications_used IS 'Structured birth outcome: medications used during delivery (text[]).';

