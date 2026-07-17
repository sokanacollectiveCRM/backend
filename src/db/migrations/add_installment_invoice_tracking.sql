-- Legitimate installment invoice tracking. The historical verification_invoice_*
-- columns are intentionally retained for production compatibility but deprecated.
ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS qbo_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_generated_by UUID,
  ADD COLUMN IF NOT EXISTS card_status_at_invoice VARCHAR(20),
  ADD COLUMN IF NOT EXISTS card_warning_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invoice_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_email_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_email_error TEXT;

-- Legacy rows and some QuickBooks responses may omit non-sensitive card metadata.
-- Keep the provider reference/status authoritative without inventing expiry values.
ALTER TABLE public.client_payment_methods
  ALTER COLUMN card_brand DROP NOT NULL,
  ALTER COLUMN last4 DROP NOT NULL,
  ALTER COLUMN exp_month DROP NOT NULL,
  ALTER COLUMN exp_year DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS payment_installments_qbo_invoice_id_uidx
  ON public.payment_installments (qbo_invoice_id)
  WHERE qbo_invoice_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_onboarding_readiness'
      AND column_name = 'verification_invoice_id'
  ) THEN
    COMMENT ON COLUMN public.client_onboarding_readiness.verification_invoice_id
      IS 'DEPRECATED: retained for historical reconciliation only; must not affect active billing or portal eligibility';
    COMMENT ON COLUMN public.client_onboarding_readiness.verification_invoice_sent_at
      IS 'DEPRECATED: retained for historical reconciliation only; must not affect active billing or portal eligibility';
    COMMENT ON COLUMN public.client_onboarding_readiness.verification_invoice_paid_at
      IS 'DEPRECATED: retained for historical reconciliation only; must not affect active billing or portal eligibility';
  END IF;
END $$;
