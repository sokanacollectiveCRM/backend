DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_clients'
      AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.phi_clients ADD COLUMN payment_method text;
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.payment_method IS 'Client payment method for operational/billing workflows.';
