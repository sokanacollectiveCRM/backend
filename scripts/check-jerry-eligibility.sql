-- Check if jerry@techluminateacademy.com is eligible for portal invite
-- Eligibility requires:
-- 1. Contract status = 'signed'
-- 2. Deposit payment status = 'succeeded'

SELECT
  ci.id as client_id,
  ci.email,
  ci.firstname,
  ci.lastname,
  ci.status as client_status,
  ci.portal_status,
  c.id as contract_id,
  c.status as contract_status,
  cp.id as payment_id,
  cp.payment_type,
  cp.status as payment_status,
  cp.amount,
  cp.completed_at,
  -- Check eligibility
  CASE
    WHEN c.status = 'signed' AND cp.status = 'succeeded' THEN 'ELIGIBLE ✅'
    WHEN c.status != 'signed' THEN 'NOT ELIGIBLE: Contract not signed ❌'
    WHEN cp.status != 'succeeded' THEN 'NOT ELIGIBLE: Payment not completed ❌'
    WHEN c.id IS NULL THEN 'NOT ELIGIBLE: No contract found ❌'
    WHEN cp.id IS NULL THEN 'NOT ELIGIBLE: No deposit payment found ❌'
    ELSE 'NOT ELIGIBLE ❌'
  END as eligibility_status
FROM client_info ci
LEFT JOIN contracts c ON c.client_id = ci.id
LEFT JOIN contract_payments cp ON cp.contract_id = c.id AND cp.payment_type = 'deposit'
WHERE ci.email = 'jerry@techluminateacademy.com';

