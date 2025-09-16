-- Add deposit_due_date field to payment_schedules table

-- Add the column
ALTER TABLE payment_schedules
ADD COLUMN IF NOT EXISTS deposit_due_date DATE;

-- Add comment to explain the field
COMMENT ON COLUMN payment_schedules.deposit_due_date IS 'Date when the deposit is due (usually same as start_date)';

-- Update existing records to set deposit_due_date = start_date
UPDATE payment_schedules
SET deposit_due_date = start_date
WHERE deposit_due_date IS NULL;

-- Verify the change
SELECT
    ps.id,
    ps.contract_id,
    ps.schedule_name,
    ps.total_amount,
    ps.deposit_amount,
    ps.deposit_due_date,
    ps.start_date,
    ps.end_date,
    ps.number_of_installments,
    ps.payment_frequency
FROM payment_schedules ps
ORDER BY ps.created_at DESC
LIMIT 3;
