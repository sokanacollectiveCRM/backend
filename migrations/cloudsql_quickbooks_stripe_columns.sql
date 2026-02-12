-- QuickBooks + Stripe schema for Cloud SQL (sokana_private)
-- Run once: creates quickbooks_tokens, adds columns to phi_clients and payments.
-- Add-only + idempotent (IF NOT EXISTS everywhere).
-- Run: PGPASSWORD='...' psql -h 127.0.0.1 -p 5433 -U app_user -d sokana_private -f migrations/cloudsql_quickbooks_stripe_columns.sql

BEGIN;

-- 1) QuickBooks tokens table (Cloud SQL)
CREATE TABLE IF NOT EXISTS public.quickbooks_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who this token belongs to in your app (admin user id, system actor, etc.)
  actor_id uuid,

  -- QuickBooks company realm
  realm_id text NOT NULL,

  -- OAuth tokens
  access_token text NOT NULL,
  refresh_token text NOT NULL,

  -- Expirations (store timestamps, not seconds)
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,

  -- Optional metadata
  scope text,
  token_type text DEFAULT 'bearer',
  environment text DEFAULT 'production', -- 'sandbox' / 'production'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicates per realm/environment (change if you want multiple actors per realm)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quickbooks_tokens_realm_env
  ON public.quickbooks_tokens (realm_id, environment);

CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_actor
  ON public.quickbooks_tokens (actor_id);

-- 2) Client links (no separate customers table)
ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS qbo_customer_id text;

CREATE INDEX IF NOT EXISTS idx_phi_clients_stripe_customer_id
  ON public.phi_clients (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_phi_clients_qbo_customer_id
  ON public.phi_clients (qbo_customer_id);

-- 3) Payments sync columns (only if payments exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='payments'
  ) THEN
    ALTER TABLE public.payments
      ADD COLUMN IF NOT EXISTS qbo_payment_id text,
      ADD COLUMN IF NOT EXISTS qb_sync_status text,
      ADD COLUMN IF NOT EXISTS qb_sync_error text;

    CREATE INDEX IF NOT EXISTS idx_payments_qbo_payment_id
      ON public.payments (qbo_payment_id);

    CREATE INDEX IF NOT EXISTS idx_payments_qb_sync_status
      ON public.payments (qb_sync_status);
  END IF;
END $$;

COMMIT;
