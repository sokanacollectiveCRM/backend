-- Idempotent, non-destructive CRM payment schedule migration.
-- REVIEW THE TARGET FIRST. Do not run against production without an approved change window.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.phi_contracts(id),
  schedule_name TEXT NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  installment_amount NUMERIC(14,2),
  number_of_installments INTEGER NOT NULL DEFAULT 0,
  payment_frequency VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS contract_id UUID,
  ADD COLUMN IF NOT EXISTS schedule_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS number_of_installments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(50),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS public.payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id),
  amount NUMERIC(14,2) NOT NULL,
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'upcoming',
  payment_type VARCHAR(50) NOT NULL DEFAULT 'installment',
  payment_number INTEGER,
  total_payments INTEGER,
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  qbo_invoice_id TEXT,
  payment_link TEXT,
  invoice_status VARCHAR(50),
  invoice_created_at TIMESTAMPTZ,
  invoice_generated_by UUID,
  stripe_payment_intent_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS schedule_id UUID,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'installment',
  ADD COLUMN IF NOT EXISTS payment_number INTEGER,
  ADD COLUMN IF NOT EXISTS total_payments INTEGER,
  ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qbo_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_generated_by UUID,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_payment_schedules_contract_id ON public.payment_schedules(contract_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_schedule_id ON public.payment_installments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_status ON public.payment_installments(status);
CREATE INDEX IF NOT EXISTS idx_payment_installments_due_date ON public.payment_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_installments_qbo_invoice_id ON public.payment_installments(qbo_invoice_id) WHERE qbo_invoice_id IS NOT NULL;

-- Constraints are enabled only when historical data is compatible. NOTICE output
-- identifies cleanup needed before rerunning this migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_schedules_contract_id_fkey') THEN
    IF NOT EXISTS (SELECT 1 FROM public.payment_schedules ps LEFT JOIN public.phi_contracts pc ON pc.id=ps.contract_id WHERE ps.contract_id IS NULL OR pc.id IS NULL) THEN
      ALTER TABLE public.payment_schedules ADD CONSTRAINT payment_schedules_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.phi_contracts(id);
    ELSE RAISE NOTICE 'Cleanup required: payment_schedules has null/orphan contract_id values; FK not enabled'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_installments_schedule_id_fkey') THEN
    IF NOT EXISTS (SELECT 1 FROM public.payment_installments pi LEFT JOIN public.payment_schedules ps ON ps.id=pi.schedule_id WHERE pi.schedule_id IS NULL OR ps.id IS NULL) THEN
      ALTER TABLE public.payment_installments ADD CONSTRAINT payment_installments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.payment_schedules(id);
    ELSE RAISE NOTICE 'Cleanup required: payment_installments has null/orphan schedule_id values; FK not enabled'; END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.payment_schedules WHERE status IN ('draft','active') GROUP BY contract_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS payment_schedules_one_open_per_contract_uidx ON public.payment_schedules(contract_id) WHERE status IN ('draft','active');
  ELSE RAISE NOTICE 'Cleanup required: contracts with multiple draft/active schedules; active schedule unique index not enabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_installments WHERE payment_number IS NOT NULL GROUP BY schedule_id,payment_number HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS payment_installments_schedule_number_uidx ON public.payment_installments(schedule_id,payment_number) WHERE payment_number IS NOT NULL;
  ELSE RAISE NOTICE 'Cleanup required: duplicate schedule/payment_number pairs; unique index not enabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_installments WHERE NULLIF(btrim(qbo_invoice_id),'') IS NOT NULL GROUP BY qbo_invoice_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS payment_installments_qbo_invoice_id_uidx ON public.payment_installments(qbo_invoice_id) WHERE NULLIF(btrim(qbo_invoice_id),'') IS NOT NULL;
  ELSE RAISE NOTICE 'Cleanup required: duplicate QBO invoice IDs; unique index not enabled'; END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='client_onboarding_readiness' AND column_name='verification_invoice_id') THEN
    COMMENT ON COLUMN public.client_onboarding_readiness.verification_invoice_id IS 'DEPRECATED: historical reconciliation only; not active CRM installment billing';
  END IF;
END $$;

COMMIT;
