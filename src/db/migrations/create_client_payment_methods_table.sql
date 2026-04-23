-- Safe client payment-method metadata for QuickBooks Payments card-on-file storage.
-- Stores only provider references and non-sensitive card metadata.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.client_payment_methods (
  client_id uuid PRIMARY KEY REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  quickbooks_customer_id text NOT NULL,
  provider_payment_method_reference text NOT NULL,
  card_brand text NOT NULL,
  last4 text NOT NULL,
  exp_month integer NOT NULL,
  exp_year integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_payment_methods_qbo_customer_id
  ON public.client_payment_methods (quickbooks_customer_id);

DROP TRIGGER IF EXISTS trigger_client_payment_methods_updated_at ON public.client_payment_methods;
CREATE TRIGGER trigger_client_payment_methods_updated_at
  BEFORE UPDATE ON public.client_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
