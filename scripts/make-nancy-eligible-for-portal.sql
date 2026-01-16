-- Make ncowans@hotmail.com eligible for portal invite
-- This script ensures the client has:
-- 1. A contract with status = 'signed'
-- 2. A deposit payment with status = 'succeeded'

DO $$
DECLARE
  v_client_email TEXT := 'ncowans@hotmail.com';
  v_client_id UUID;
  v_contract_id UUID;
  v_payment_id UUID;
BEGIN
  RAISE NOTICE 'Making client % eligible for portal invite...', v_client_email;

  -- Step 1: Find client by email
  SELECT id INTO v_client_id
  FROM client_info
  WHERE email = v_client_email
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Client not found with email: %', v_client_email;
  END IF;

  RAISE NOTICE 'Found client ID: %', v_client_id;

  -- Step 2: Check if contract exists, create or update it
  SELECT id INTO v_contract_id
  FROM contracts
  WHERE client_id = v_client_id
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    -- Create a new contract
    INSERT INTO contracts (
      client_id,
      status,
      fee,
      deposit,
      note,
      created_at,
      updated_at
    )
    VALUES (
      v_client_id,
      'signed',
      '5000',
      '1000',
      'Created for portal invite testing - Nancy',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_contract_id;

    RAISE NOTICE 'Created new contract: %', v_contract_id;
  ELSE
    -- Update existing contract to signed
    UPDATE contracts
    SET status = 'signed',
        updated_at = NOW()
    WHERE id = v_contract_id;

    RAISE NOTICE 'Updated contract % to signed status', v_contract_id;
  END IF;

  -- Step 3: Check if deposit payment exists, create or update it
  SELECT id INTO v_payment_id
  FROM contract_payments
  WHERE contract_id = v_contract_id
    AND payment_type = 'deposit'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_payment_id IS NULL THEN
    -- Create a new deposit payment
    INSERT INTO contract_payments (
      contract_id,
      payment_type,
      status,
      amount,
      completed_at,
      created_at
    )
    VALUES (
      v_contract_id,
      'deposit',
      'succeeded',
      1000,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_payment_id;

    RAISE NOTICE 'Created new deposit payment: %', v_payment_id;
  ELSE
    -- Update existing payment to succeeded
    UPDATE contract_payments
    SET status = 'succeeded',
        completed_at = NOW()
    WHERE id = v_payment_id;

    RAISE NOTICE 'Updated payment % to succeeded status', v_payment_id;
  END IF;

  -- Step 4: Verify the setup
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Setup complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Client ID: %', v_client_id;
  RAISE NOTICE 'Email: %', v_client_email;
  RAISE NOTICE 'Contract ID: %', v_contract_id;
  RAISE NOTICE 'Payment ID: %', v_payment_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Client is now eligible for portal invite!';
  RAISE NOTICE '========================================';

END $$;

-- Verify the setup
SELECT
  ci.id as client_id,
  ci.email,
  ci.firstname,
  ci.lastname,
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
WHERE ci.email = 'ncowans@hotmail.com';

