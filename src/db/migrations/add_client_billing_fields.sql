DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'insurance_provider'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'insurance_member_id'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN insurance_member_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN policy_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'self_pay_card_info'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN self_pay_card_info text;
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.insurance_provider IS 'Billing insurance provider for client portal and CRM billing section';
COMMENT ON COLUMN public.phi_clients.insurance_member_id IS 'Billing insurance member ID';
COMMENT ON COLUMN public.phi_clients.policy_number IS 'Billing insurance policy number';
COMMENT ON COLUMN public.phi_clients.self_pay_card_info IS 'Billing self-pay card info / notes';
