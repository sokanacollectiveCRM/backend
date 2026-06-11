-- Adds QuickBooks linkage fields to Cloud SQL invoice ledger.
-- Idempotent: safe to run multiple times.

ALTER TABLE public.phi_invoices
  ADD COLUMN IF NOT EXISTS qbo_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_link TEXT,
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC;

-- Prefer invoice_number in the ledger to match existing reader expectations.
ALTER TABLE public.phi_invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Unique linkage to prevent duplicates when persisting QBO invoices repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS phi_invoices_qbo_invoice_id_uidx
  ON public.phi_invoices (qbo_invoice_id)
  WHERE qbo_invoice_id IS NOT NULL;

