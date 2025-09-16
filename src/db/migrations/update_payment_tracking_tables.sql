-- Update Payment Tracking System

-- Step 1: Update payment_schedules table
ALTER TABLE payment_schedules
ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS frequency VARCHAR(20),
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add comment to explain frequency options
COMMENT ON COLUMN payment_schedules.frequency IS 'Payment frequency: weekly, bi-weekly, monthly';
COMMENT ON COLUMN payment_schedules.status IS 'Schedule status: active, completed, cancelled';

-- Step 2: Create payment_installments table
CREATE TABLE IF NOT EXISTS payment_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID REFERENCES payment_schedules(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    invoice_id UUID REFERENCES invoices(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_installments_schedule_id ON payment_installments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_invoice_id ON payment_installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_status ON payment_installments(status);
CREATE INDEX IF NOT EXISTS idx_payment_installments_due_date ON payment_installments(due_date);

-- Add comments for documentation
COMMENT ON TABLE payment_installments IS 'Tracks individual payments within a payment schedule';
COMMENT ON COLUMN payment_installments.status IS 'Payment status: pending, paid, overdue';

-- Step 3: Create function to calculate remaining balance
CREATE OR REPLACE FUNCTION update_payment_schedule_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE payment_schedules
    SET remaining_balance = (
        SELECT total_amount - COALESCE(SUM(amount), 0)
        FROM payment_installments
        WHERE schedule_id = NEW.schedule_id
        AND status = 'paid'
    )
    WHERE id = NEW.schedule_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update remaining balance
DROP TRIGGER IF EXISTS update_schedule_balance ON payment_installments;
CREATE TRIGGER update_schedule_balance
    AFTER INSERT OR UPDATE OF status
    ON payment_installments
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_schedule_balance();

-- Step 4: Create function to automatically update payment status
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update payment status based on invoice status
    IF NEW.status = 'paid' THEN
        UPDATE payment_installments
        SET status = 'paid'
        WHERE invoice_id = NEW.id;
    ELSIF NEW.status = 'overdue' THEN
        UPDATE payment_installments
        SET status = 'overdue'
        WHERE invoice_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice status changes
DROP TRIGGER IF EXISTS invoice_status_change ON invoices;
CREATE TRIGGER invoice_status_change
    AFTER UPDATE OF status
    ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_status();

-- Step 5: Create view for payment tracking
CREATE OR REPLACE VIEW payment_tracking AS
SELECT
    ps.id as schedule_id,
    ps.contract_id,
    ps.total_amount,
    ps.remaining_balance,
    ps.frequency,
    ps.start_date,
    ps.end_date,
    ps.status as schedule_status,
    pi.id as installment_id,
    pi.amount as installment_amount,
    pi.due_date,
    pi.status as installment_status,
    i.doc_number as invoice_number,
    i.status as invoice_status
FROM payment_schedules ps
LEFT JOIN payment_installments pi ON ps.id = pi.schedule_id
LEFT JOIN invoices i ON pi.invoice_id = i.id;

-- Step 6: Create function to generate installments
CREATE OR REPLACE FUNCTION generate_payment_installments(
    p_schedule_id UUID,
    p_start_date DATE,
    p_frequency VARCHAR,
    p_num_installments INTEGER
) RETURNS VOID AS $$
DECLARE
    v_interval INTERVAL;
    v_amount DECIMAL(10,2);
    v_current_date DATE;
    i INTEGER;
BEGIN
    -- Calculate interval based on frequency
    v_interval := CASE p_frequency
        WHEN 'weekly' THEN '1 week'::INTERVAL
        WHEN 'bi-weekly' THEN '2 weeks'::INTERVAL
        WHEN 'monthly' THEN '1 month'::INTERVAL
        ELSE '1 month'::INTERVAL
    END;

    -- Calculate amount per installment
    SELECT total_amount / p_num_installments
    INTO v_amount
    FROM payment_schedules
    WHERE id = p_schedule_id;

    -- Generate installments
    v_current_date := p_start_date;
    FOR i IN 1..p_num_installments LOOP
        INSERT INTO payment_installments (
            schedule_id,
            amount,
            due_date,
            status
        ) VALUES (
            p_schedule_id,
            v_amount,
            v_current_date,
            'pending'
        );
        v_current_date := v_current_date + v_interval;
    END LOOP;

    -- Update schedule end date
    UPDATE payment_schedules
    SET end_date = v_current_date - v_interval
    WHERE id = p_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Final verification
SELECT
    'Payment Tracking System Updated Successfully!' as status,
    (SELECT COUNT(*) FROM payment_schedules) as total_schedules,
    (SELECT COUNT(*) FROM payment_installments) as total_installments;
