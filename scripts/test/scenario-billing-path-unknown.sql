-- Scenario: Unknown payment method + signed contract + paid deposit + card on file
-- Expected API: is_eligible=false, primary_portal_blocker=billing_path_unknown
-- Usage: ./scripts/test/run-portal-readiness-scenario.sh billing-path-unknown

BEGIN;

UPDATE public.phi_clients
SET payment_method = 'Cash Plan',
    updated_at = NOW()
WHERE id = :'client_id'::uuid;

INSERT INTO public.phi_contracts (id, client_id, status)
SELECT gen_random_uuid(), :'client_id'::uuid, 'signed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.phi_contracts WHERE client_id = :'client_id'::uuid
);

UPDATE public.phi_contracts
SET status = 'signed'
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.payments
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.payment_installments pi
USING public.payment_schedules ps
JOIN public.phi_contracts pc ON pc.id = ps.contract_id
WHERE pi.schedule_id = ps.id
  AND pc.client_id = :'client_id'::uuid;

INSERT INTO public.payment_schedules (
  id,
  contract_id,
  schedule_name,
  total_amount,
  deposit_amount,
  start_date,
  status
)
SELECT
  gen_random_uuid(),
  pc.id,
  'Test deposit schedule',
  1000.00,
  100.00,
  CURRENT_DATE,
  'active'
FROM public.phi_contracts pc
WHERE pc.client_id = :'client_id'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_schedules ps WHERE ps.contract_id = pc.id
  );

INSERT INTO public.payment_installments (
  id,
  schedule_id,
  amount,
  due_date,
  status,
  payment_type,
  payment_number,
  total_payments
)
SELECT
  gen_random_uuid(),
  ps.id,
  100.00,
  CURRENT_DATE,
  'paid',
  'deposit',
  1,
  1
FROM public.payment_schedules ps
JOIN public.phi_contracts pc ON pc.id = ps.contract_id
WHERE pc.client_id = :'client_id'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_installments pi
    WHERE pi.schedule_id = ps.id
      AND COALESCE(pi.payment_type, '') = 'deposit'
  );

INSERT INTO public.client_payment_methods (
  client_id,
  quickbooks_customer_id,
  provider_payment_method_reference,
  card_brand,
  last4,
  exp_month,
  exp_year,
  status
)
SELECT
  c.id,
  COALESCE(c.qbo_customer_id, 'test_qbo_customer'),
  'qbpm_test_123',
  'visa',
  '4242',
  12,
  2030,
  'ACTIVE'
FROM public.phi_clients c
WHERE c.id = :'client_id'::uuid
ON CONFLICT (client_id) DO UPDATE SET
  provider_payment_method_reference = EXCLUDED.provider_payment_method_reference,
  status = EXCLUDED.status,
  updated_at = NOW();

DELETE FROM public.client_onboarding_events
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.client_onboarding_readiness
WHERE client_id = :'client_id'::uuid;

COMMIT;
