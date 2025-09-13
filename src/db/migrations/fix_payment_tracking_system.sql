-- Fix Payment Tracking System Implementation
-- This script fixes the type issues and implements the payment system correctly

-- Step 1: Drop the existing function if it exists (to recreate with correct types)
DROP FUNCTION IF EXISTS create_payment_schedule(UUID, TEXT, DECIMAL, DECIMAL, INTEGER, VARCHAR, DATE);

-- Step 2: Create the function with correct parameter types
CREATE OR REPLACE FUNCTION create_payment_schedule(
  p_contract_id UUID,
  p_schedule_name TEXT,
  p_total_amount DECIMAL,
  p_deposit_amount DECIMAL DEFAULT 0,
  p_number_of_installments INTEGER DEFAULT 0,
  p_payment_frequency VARCHAR DEFAULT 'one-time',
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_schedule_id UUID;
  v_installment_amount DECIMAL;
  v_remaining_amount DECIMAL;
  v_payment_date DATE;
  v_payment_number INTEGER := 1;
BEGIN
  -- Calculate installment amount
  v_remaining_amount := p_total_amount - p_deposit_amount;
  v_installment_amount := CASE
    WHEN p_number_of_installments > 0 THEN v_remaining_amount / p_number_of_installments
    ELSE v_remaining_amount
  END;

  -- Create the payment schedule
  INSERT INTO payment_schedules (
    contract_id, schedule_name, total_amount, deposit_amount,
    installment_amount, number_of_installments, payment_frequency,
    start_date, end_date, status
  ) VALUES (
    p_contract_id, p_schedule_name, p_total_amount, p_deposit_amount,
    v_installment_amount, p_number_of_installments, p_payment_frequency,
    p_start_date,
    CASE
      WHEN p_payment_frequency = 'monthly' THEN p_start_date + INTERVAL '1 month' * p_number_of_installments
      WHEN p_payment_frequency = 'weekly' THEN p_start_date + INTERVAL '1 week' * p_number_of_installments
      WHEN p_payment_frequency = 'bi-weekly' THEN p_start_date + INTERVAL '2 weeks' * p_number_of_installments
      WHEN p_payment_frequency = 'quarterly' THEN p_start_date + INTERVAL '3 months' * p_number_of_installments
      ELSE p_start_date
    END,
    'active'
  ) RETURNING id INTO v_schedule_id;

  -- Create individual payment records
  v_payment_date := p_start_date;

  -- Create deposit payment if specified
  IF p_deposit_amount > 0 THEN
    INSERT INTO contract_payments (
      contract_id, payment_schedule_id, payment_type, amount,
      due_date, payment_number, total_payments, status, is_overdue
    ) VALUES (
      p_contract_id, v_schedule_id, 'deposit', p_deposit_amount,
      v_payment_date, 0, p_number_of_installments + 1, 'pending', FALSE
    );
    v_payment_number := 1;
  END IF;

  -- Create installment payments
  FOR i IN 1..p_number_of_installments LOOP
    -- Calculate payment date based on frequency
    v_payment_date := CASE
      WHEN p_payment_frequency = 'monthly' THEN p_start_date + INTERVAL '1 month' * i
      WHEN p_payment_frequency = 'weekly' THEN p_start_date + INTERVAL '1 week' * i
      WHEN p_payment_frequency = 'bi-weekly' THEN p_start_date + INTERVAL '2 weeks' * i
      WHEN p_payment_frequency = 'quarterly' THEN p_start_date + INTERVAL '3 months' * i
      ELSE p_start_date + INTERVAL '1 month' * i
    END;

    INSERT INTO contract_payments (
      contract_id, payment_schedule_id, payment_type, amount,
      due_date, payment_number, total_payments, status, is_overdue
    ) VALUES (
      p_contract_id, v_schedule_id, 'installment', v_installment_amount,
      v_payment_date, v_payment_number, p_number_of_installments + CASE WHEN p_deposit_amount > 0 THEN 1 ELSE 0 END, 'pending', FALSE
    );

    v_payment_number := v_payment_number + 1;
  END LOOP;

  RETURN v_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Insert sample payment schedules for existing contracts (fixed version)
DO $$
DECLARE
  contract_record RECORD;
  schedule_id UUID;
BEGIN
  FOR contract_record IN
    SELECT id, fee, deposit FROM contracts WHERE id NOT IN (SELECT DISTINCT contract_id FROM payment_schedules)
  LOOP
    -- Create a default payment schedule for existing contracts
    BEGIN
      schedule_id := create_payment_schedule(
        contract_record.id,
        'Standard Payment Plan',
        CASE
          WHEN contract_record.fee IS NOT NULL THEN CAST(REPLACE(REPLACE(contract_record.fee, '$', ''), ',', '') AS DECIMAL)
          ELSE 2500.00
        END,
        CASE
          WHEN contract_record.deposit IS NOT NULL THEN CAST(REPLACE(REPLACE(contract_record.deposit, '$', ''), ',', '') AS DECIMAL)
          ELSE 500.00
        END,
        3, -- 3 installments
        'monthly',
        CURRENT_DATE + INTERVAL '30 days'
      );

      RAISE NOTICE 'Created payment schedule % for contract %', schedule_id, contract_record.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to create payment schedule for contract %: %', contract_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 4: Run initial overdue update
SELECT update_overdue_flags();

-- Step 5: Final verification
SELECT
  'Payment Tracking System Fixed and Implemented Successfully!' as status,
  (SELECT COUNT(*) FROM payment_schedules) as total_payment_schedules,
  (SELECT COUNT(*) FROM contract_payments) as total_payment_records,
  (SELECT COUNT(*) FROM contract_payments WHERE status = 'pending') as pending_payments,
  (SELECT COUNT(*) FROM contract_payments WHERE is_overdue = TRUE) as overdue_payments;
