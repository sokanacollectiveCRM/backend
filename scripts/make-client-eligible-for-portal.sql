-- Make client eligible for portal invite
-- This script ensures the client has:
-- 1. A contract with status = 'signed'
-- 2. A deposit payment with status = 'succeeded'

-- Set the client ID here
DO $$
DECLARE
  v_client_id UUID := 'a3c432d2-8bb1-4366-92ea-4ccd1d738286';
  v_contract_id UUID;
  v_payment_id UUID;
BEGIN
  RAISE NOTICE 'Making client % eligible for portal invite...', v_client_id;

  -- Step 1: Check if contract exists, create or update it
  SELECT id INTO v_contract_id
  FROM contracts
  WHERE client_id = v_client_id
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    -- Create a new contract
    INSERT INTO contracts (client_id, status, fee, deposit, note, created_at, updated_at)
    VALUES (
      v_client_id,
      'signed',
      '5000',
      '1000',
      'Created for portal invite testing',
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

  -- Step 2: Check if deposit payment exists, create or update it
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
        completed_at = COALESCE(completed_at, NOW())
    WHERE id = v_payment_id;

    RAISE NOTICE 'Updated payment % to succeeded status', v_payment_id;
  END IF;

  RAISE NOTICE '✅ Client % is now eligible for portal invite!', v_client_id;
  RAISE NOTICE '   Contract ID: %', v_contract_id;
  RAISE NOTICE '   Payment ID: %', v_payment_id;
END $$;
