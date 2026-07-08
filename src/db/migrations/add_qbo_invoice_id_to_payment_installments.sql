ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS qbo_invoice_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_installments_qbo_invoice_id
  ON public.payment_installments (qbo_invoice_id)
  WHERE qbo_invoice_id IS NOT NULL;
