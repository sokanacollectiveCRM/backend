-- Cloud SQL: payment_schedules and payment_installments for contract payment plans
-- References phi_contracts (Cloud SQL). Run on sokana_private.

-- payment_schedules: one per contract (Labor Support)
CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.phi_contracts(id) ON DELETE CASCADE,
  schedule_name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  installment_amount DECIMAL(10,2),
  number_of_installments INTEGER DEFAULT 0,
  payment_frequency VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_contract_id ON public.payment_schedules(contract_id);

-- payment_installments: individual payments (deposit + installments)
CREATE TABLE IF NOT EXISTS public.payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  payment_type VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255),
  payment_number INTEGER,
  total_payments INTEGER,
  is_overdue BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_installments_schedule_id ON public.payment_installments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_status ON public.payment_installments(status);

-- Add contract_id to payments if missing (for linking)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS contract_id UUID;
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON public.payments(contract_id) WHERE contract_id IS NOT NULL;
