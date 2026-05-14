-- Expanded primary insurance (Medicaid parity): policy holder + plan type on phi_clients.
-- Group number remains optional in app validation (column already nullable text).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'insurance_policy_holder_name'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_policy_holder_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'insurance_policy_holder_dob'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_policy_holder_dob date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'insurance_policy_holder_relationship'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_policy_holder_relationship text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'insurance_plan_type'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_plan_type text;
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.insurance_policy_holder_name IS 'Primary insurance: legal name of policy holder (PHI)';
COMMENT ON COLUMN public.phi_clients.insurance_policy_holder_dob IS 'Primary insurance: policy holder date of birth (PHI)';
COMMENT ON COLUMN public.phi_clients.insurance_policy_holder_relationship IS 'Primary insurance: relationship of policy holder to client';
COMMENT ON COLUMN public.phi_clients.insurance_plan_type IS 'Primary insurance: HMO, PPO, EPO, POS, HDHP, Medicaid, Medicare, Other';
COMMENT ON COLUMN public.phi_clients.policy_number IS 'Primary insurance: group / policy number (optional; formerly required for commercial/private)';
