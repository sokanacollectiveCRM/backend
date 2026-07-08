-- Scenario: Self-Pay + unsigned contract + unpaid deposit + no card
-- Expected API: is_eligible=false, primary_portal_blocker=contract_unsigned
-- Usage: ./scripts/test/run-portal-readiness-scenario.sh unsigned-contract

BEGIN;

UPDATE public.phi_clients
SET payment_method = 'Self-Pay',
    updated_at = NOW()
WHERE id = :'client_id'::uuid;

INSERT INTO public.phi_contracts (id, client_id, status)
SELECT gen_random_uuid(), :'client_id'::uuid, 'draft'
WHERE NOT EXISTS (
  SELECT 1 FROM public.phi_contracts WHERE client_id = :'client_id'::uuid
);

UPDATE public.phi_contracts
SET status = 'draft'
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.client_payment_methods
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.payments
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.payment_installments pi
USING public.payment_schedules ps
JOIN public.phi_contracts pc ON pc.id = ps.contract_id
WHERE pi.schedule_id = ps.id
  AND pc.client_id = :'client_id'::uuid;

DELETE FROM public.client_onboarding_events
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.client_onboarding_readiness
WHERE client_id = :'client_id'::uuid;

COMMIT;
