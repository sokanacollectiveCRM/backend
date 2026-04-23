-- Add secondary billing fields used by request intake and client billing views.
-- Run on sokana_private (Cloud SQL).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_clients'
      AND column_name = 'insurance_phone_number'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_clients'
      AND column_name = 'has_secondary_insurance'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN has_secondary_insurance boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_clients'
      AND column_name = 'secondary_insurance_provider'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN secondary_insurance_provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_clients'
      AND column_name = 'secondary_insurance_member_id'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN secondary_insurance_member_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_clients'
      AND column_name = 'secondary_policy_number'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN secondary_policy_number text;
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.insurance_phone_number IS 'Billing insurance contact phone number';
COMMENT ON COLUMN public.phi_clients.has_secondary_insurance IS 'Whether the client has secondary insurance coverage';
COMMENT ON COLUMN public.phi_clients.secondary_insurance_provider IS 'Secondary insurance provider name';
COMMENT ON COLUMN public.phi_clients.secondary_insurance_member_id IS 'Secondary insurance member ID';
COMMENT ON COLUMN public.phi_clients.secondary_policy_number IS 'Secondary insurance policy number';
