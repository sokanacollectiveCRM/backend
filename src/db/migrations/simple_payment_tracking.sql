-- Simple payment tracking system for contracts
-- Focuses on: payment schedules, due dates, payment status, overdue tracking, payment history

-- Step 1: Enhance the contract_payments table with simplified tracking
ALTER TABLE contract_payments
ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE contract_payments
ADD COLUMN IF NOT EXISTS payment_schedule_id UUID;

ALTER TABLE contract_payments
ADD COLUMN IF NOT EXISTS payment_number INTEGER;

ALTER TABLE contract_payments
ADD COLUMN IF NOT EXISTS total_payments INTEGER;

ALTER TABLE contract_payments
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_payments
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Step 2: Create payment schedules table for contract payment plans
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  schedule_name TEXT NOT NULL, -- e.g., "Deposit + 3 Installments", "Monthly Payments"
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  installment_amount DECIMAL(10,2),
  number_of_installments INTEGER DEFAULT 0,
  payment_frequency VARCHAR(50), -- 'one-time', 'weekly', 'bi-weekly', 'monthly', 'quarterly'
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contract_payments_due_date ON contract_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_contract_payments_schedule_id ON contract_payments(payment_schedule_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_payment_number ON contract_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_contract_payments_status ON contract_payments(status);
CREATE INDEX IF NOT EXISTS idx_contract_payments_is_overdue ON contract_payments(is_overdue);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_contract_id ON payment_schedules(contract_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_status ON payment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_start_date ON payment_schedules(start_date);

-- Step 4: Add foreign key constraint for payment_schedule_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contract_payments_schedule_id_fkey'
    AND table_name = 'contract_payments'
  ) THEN
    ALTER TABLE contract_payments
    ADD CONSTRAINT contract_payments_schedule_id_fkey
    FOREIGN KEY (payment_schedule_id) REFERENCES payment_schedules(id);
  END IF;
END $$;

-- Step 5: Create triggers for automatic timestamp updates
CREATE TRIGGER update_payment_schedules_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Create function to automatically update overdue flags
CREATE OR REPLACE FUNCTION update_overdue_flags()
RETURNS void AS $$
BEGIN
  -- Mark payments as overdue if due date has passed and status is pending/failed
  UPDATE contract_payments
  SET is_overdue = TRUE
  WHERE due_date < CURRENT_DATE
  AND status IN ('pending', 'failed')
  AND is_overdue = FALSE;

  -- Mark payments as not overdue if they've been paid
  UPDATE contract_payments
  SET is_overdue = FALSE
  WHERE status = 'succeeded'
  AND is_overdue = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to create a payment schedule
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

-- Step 8: Create function to get payment summary for a contract
CREATE OR REPLACE FUNCTION get_contract_payment_summary(p_contract_id UUID)
RETURNS TABLE (
  total_amount DECIMAL,
  total_paid DECIMAL,
  total_due DECIMAL,
  overdue_amount DECIMAL,
  next_payment_due DATE,
  next_payment_amount DECIMAL,
  payment_count INTEGER,
  overdue_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(cp.amount), 0) as total_amount,
    COALESCE(SUM(cp.amount) FILTER (WHERE cp.status = 'succeeded'), 0) as total_paid,
    COALESCE(SUM(cp.amount) FILTER (WHERE cp.status IN ('pending', 'failed')), 0) as total_due,
    COALESCE(SUM(cp.amount) FILTER (WHERE cp.status IN ('pending', 'failed') AND cp.is_overdue = TRUE), 0) as overdue_amount,
    MIN(cp.due_date) FILTER (WHERE cp.status IN ('pending', 'failed')) as next_payment_due,
    MIN(cp.amount) FILTER (WHERE cp.status IN ('pending', 'failed')) as next_payment_amount,
    COUNT(cp.id) as payment_count,
    COUNT(cp.id) FILTER (WHERE cp.is_overdue = TRUE) as overdue_count
  FROM contract_payments cp
  WHERE cp.contract_id = p_contract_id;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create function to get overdue payments
CREATE OR REPLACE FUNCTION get_overdue_payments()
RETURNS TABLE (
  payment_id UUID,
  contract_id UUID,
  client_name TEXT,
  client_email TEXT,
  payment_type VARCHAR,
  amount DECIMAL,
  due_date DATE,
  days_overdue INTEGER,
  payment_schedule_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id as payment_id,
    cp.contract_id,
    CONCAT(ci.first_name, ' ', ci.last_name) as client_name,
    ci.email as client_email,
    cp.payment_type,
    cp.amount,
    cp.due_date,
    CURRENT_DATE - cp.due_date as days_overdue,
    ps.schedule_name as payment_schedule_name
  FROM contract_payments cp
  JOIN contracts c ON cp.contract_id = c.id
  JOIN client_info ci ON c.client_id = ci.id
  LEFT JOIN payment_schedules ps ON cp.payment_schedule_id = ps.id
  WHERE cp.is_overdue = TRUE
  ORDER BY cp.due_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create helpful views
CREATE OR REPLACE VIEW payment_dashboard AS
SELECT
  c.id as contract_id,
  CONCAT(ci.first_name, ' ', ci.last_name) as client_name,
  ci.email as client_email,
  c.status as contract_status,
  ps.schedule_name,
  ps.total_amount,
  ps.status as schedule_status,
  ps.start_date,
  ps.end_date,
  COUNT(cp.id) as total_payments,
  COUNT(cp.id) FILTER (WHERE cp.status = 'succeeded') as paid_payments,
  COUNT(cp.id) FILTER (WHERE cp.status IN ('pending', 'failed')) as pending_payments,
  COUNT(cp.id) FILTER (WHERE cp.is_overdue = TRUE) as overdue_payments,
  COALESCE(SUM(cp.amount) FILTER (WHERE cp.status = 'succeeded'), 0) as total_paid,
  COALESCE(SUM(cp.amount) FILTER (WHERE cp.status IN ('pending', 'failed')), 0) as total_due,
  COALESCE(SUM(cp.amount) FILTER (WHERE cp.is_overdue = TRUE), 0) as overdue_amount,
  MIN(cp.due_date) FILTER (WHERE cp.status IN ('pending', 'failed')) as next_payment_due
FROM contracts c
JOIN client_info ci ON c.client_id = ci.id
LEFT JOIN payment_schedules ps ON c.id = ps.contract_id
LEFT JOIN contract_payments cp ON c.id = cp.contract_id
GROUP BY c.id, ci.first_name, ci.last_name, ci.email, c.status, ps.schedule_name, ps.total_amount, ps.status, ps.start_date, ps.end_date;

-- Step 11: Add comments for documentation
COMMENT ON TABLE payment_schedules IS 'Payment schedules for contracts - defines payment plans and frequencies';
COMMENT ON COLUMN contract_payments.due_date IS 'When the payment is due';
COMMENT ON COLUMN contract_payments.payment_schedule_id IS 'References payment_schedules.id for grouped payments';
COMMENT ON COLUMN contract_payments.payment_number IS 'Payment number in the schedule (1, 2, 3, etc.)';
COMMENT ON COLUMN contract_payments.total_payments IS 'Total number of payments in this schedule';
COMMENT ON COLUMN contract_payments.is_overdue IS 'Automatically set to TRUE when due date passes and payment is pending/failed';

-- Step 12: Create a function to run daily overdue updates (can be called by a cron job)
CREATE OR REPLACE FUNCTION daily_payment_maintenance()
RETURNS void AS $$
BEGIN
  -- Update overdue flags
  PERFORM update_overdue_flags();

  -- Update payment schedule status to completed if all payments are succeeded
  UPDATE payment_schedules
  SET status = 'completed'
  WHERE status = 'active'
  AND id IN (
    SELECT ps.id
    FROM payment_schedules ps
    LEFT JOIN contract_payments cp ON ps.id = cp.payment_schedule_id
    GROUP BY ps.id
    HAVING COUNT(cp.id) = COUNT(cp.id) FILTER (WHERE cp.status = 'succeeded')
  );
END;
$$ LANGUAGE plpgsql;

-- Step 13: Insert sample payment schedules for existing contracts
-- This will create payment schedules for any existing contracts
DO $$
DECLARE
  contract_record RECORD;
BEGIN
  FOR contract_record IN
    SELECT id, fee, deposit FROM contracts WHERE id NOT IN (SELECT DISTINCT contract_id FROM payment_schedules)
  LOOP
    -- Create a default payment schedule for existing contracts
    PERFORM create_payment_schedule(
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
  END LOOP;
END $$;

-- Step 14: Run initial overdue update
SELECT update_overdue_flags();

-- Step 15: Final verification
SELECT
  'Simple Payment Tracking System Ready!' as status,
  (SELECT COUNT(*) FROM payment_schedules) as total_payment_schedules,
  (SELECT COUNT(*) FROM contract_payments) as total_payment_records,
  (SELECT COUNT(*) FROM contract_payments WHERE status = 'pending') as pending_payments,
  (SELECT COUNT(*) FROM contract_payments WHERE is_overdue = TRUE) as overdue_payments;
