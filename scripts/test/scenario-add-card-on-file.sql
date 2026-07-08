-- Add card-on-file metadata for fixture client (no raw PAN/CVV).
-- Usage: ./scripts/test/run-portal-readiness-scenario.sh add-card

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
  quickbooks_customer_id = EXCLUDED.quickbooks_customer_id,
  provider_payment_method_reference = EXCLUDED.provider_payment_method_reference,
  card_brand = EXCLUDED.card_brand,
  last4 = EXCLUDED.last4,
  exp_month = EXCLUDED.exp_month,
  exp_year = EXCLUDED.exp_year,
  status = EXCLUDED.status,
  updated_at = NOW();
