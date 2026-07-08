-- Reset portal readiness fixture state for one client.
-- Usage: ./scripts/test/run-portal-readiness-scenario.sh reset

BEGIN;

DELETE FROM public.client_onboarding_events
WHERE client_id = :'client_id'::uuid;

DELETE FROM public.client_onboarding_readiness
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

COMMIT;
