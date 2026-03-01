-- Customers table for Stripe/QuickBooks customer mapping (Cloud SQL)
-- Used when Supabase customers table is not available.

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  name text,
  stripe_customer_id text,
  qbo_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON public.customers(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
