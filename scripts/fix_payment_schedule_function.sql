-- Fix the createPaymentSchedule function to match actual table structure
-- Based on the payment_schedules table from implement_payment_tracking_system.sql

-- First, let's check if the payment_installments table exists
-- If not, we'll create it
CREATE TABLE IF NOT EXISTS payment_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID REFERENCES payment_schedules(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_installments_schedule_id ON payment_installments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_invoice_id ON payment_installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_due_date ON payment_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_installments_status ON payment_installments(status);

-- Create a function to generate installments for a given schedule
CREATE OR REPLACE FUNCTION generate_installments_for_schedule(p_schedule_id UUID)
RETURNS VOID AS $$
DECLARE
    v_schedule payment_schedules%ROWTYPE;
    v_remaining_balance DECIMAL;
    v_installment_amount DECIMAL;
    v_current_date DATE;
    v_num_installments INTEGER;
    v_interval TEXT;
    v_next_due_date DATE;
BEGIN
    SELECT * INTO v_schedule FROM payment_schedules WHERE id = p_schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment schedule with ID % not found', p_schedule_id;
    END IF;

    -- Clear existing installments for this schedule to prevent duplicates on re-run
    DELETE FROM payment_installments WHERE schedule_id = p_schedule_id;

    v_remaining_balance := v_schedule.total_amount - COALESCE(v_schedule.deposit_amount, 0);
    v_num_installments := COALESCE(v_schedule.number_of_installments, 0);
    v_current_date := v_schedule.start_date;
    v_interval := CASE v_schedule.payment_frequency
                    WHEN 'weekly' THEN '1 week'
                    WHEN 'bi-weekly' THEN '2 weeks'
                    WHEN 'monthly' THEN '1 month'
                    ELSE '1 month' -- Default to monthly
                  END;

    IF v_num_installments > 0 THEN
        v_installment_amount := v_remaining_balance / v_num_installments;
    ELSE
        v_installment_amount := v_remaining_balance; -- One-time payment if no installments
    END IF;

    FOR i IN 1..v_num_installments LOOP
        v_next_due_date := v_current_date + (v_interval::INTERVAL * i);
        INSERT INTO payment_installments (schedule_id, amount, due_date, status)
        VALUES (p_schedule_id, v_installment_amount, v_next_due_date, 'pending');
    END LOOP;

    -- Update the end_date in the schedule
    UPDATE payment_schedules
    SET end_date = v_current_date + (v_interval::INTERVAL * v_num_installments)
    WHERE id = p_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Test the function with a sample schedule
-- This will create a test payment schedule and generate installments
DO $$
DECLARE
    v_contract_id UUID;
    v_schedule_id UUID;
BEGIN
    -- Create a test contract if it doesn't exist
    INSERT INTO contracts (id, client_id, status, fee, deposit)
    VALUES ('test-contract-' || extract(epoch from now())::text,
            (SELECT id FROM client_info LIMIT 1),
            'active',
            '1200.00',
            '600.00')
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_contract_id;

    -- If no contract was created, get an existing one
    IF v_contract_id IS NULL THEN
        SELECT id INTO v_contract_id FROM contracts LIMIT 1;
    END IF;

    -- Create a payment schedule
    INSERT INTO payment_schedules (
        contract_id,
        schedule_name,
        total_amount,
        deposit_amount,
        installment_amount,
        number_of_installments,
        payment_frequency,
        start_date,
        status
    ) VALUES (
        v_contract_id,
        'Test Payment Plan',
        1200.00,
        600.00,
        200.00, -- (1200 - 600) / 3
        3,
        'monthly',
        CURRENT_DATE,
        'active'
    ) RETURNING id INTO v_schedule_id;

    -- Generate installments
    PERFORM generate_installments_for_schedule(v_schedule_id);

    RAISE NOTICE 'Test payment schedule created with ID: %', v_schedule_id;
END;
$$;

-- Verify the results
SELECT
    ps.id as schedule_id,
    ps.schedule_name,
    ps.total_amount,
    ps.deposit_amount,
    ps.number_of_installments,
    ps.payment_frequency,
    ps.start_date,
    ps.end_date,
    ps.status,
    COUNT(pi.id) as installment_count
FROM payment_schedules ps
LEFT JOIN payment_installments pi ON ps.id = pi.schedule_id
WHERE ps.schedule_name = 'Test Payment Plan'
GROUP BY ps.id, ps.schedule_name, ps.total_amount, ps.deposit_amount,
         ps.number_of_installments, ps.payment_frequency, ps.start_date,
         ps.end_date, ps.status;

-- Show the installments
SELECT
    pi.id,
    pi.schedule_id,
    pi.amount,
    pi.due_date,
    pi.status,
    pi.created_at
FROM payment_installments pi
JOIN payment_schedules ps ON pi.schedule_id = ps.id
WHERE ps.schedule_name = 'Test Payment Plan'
ORDER BY pi.due_date;
