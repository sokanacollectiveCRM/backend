-- Check where payment schedule data is stored

-- 1. Check payment_schedules table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payment_schedules' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check payment_installments table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payment_installments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Show recent payment schedules
SELECT
    ps.id,
    ps.contract_id,
    ps.schedule_name,
    ps.total_amount,
    ps.deposit_amount,
    ps.number_of_installments,
    ps.payment_frequency,
    ps.start_date,
    ps.end_date,
    ps.status,
    ps.created_at
FROM payment_schedules ps
ORDER BY ps.created_at DESC
LIMIT 5;

-- 4. Show recent payment installments
SELECT
    pi.id,
    pi.schedule_id,
    pi.amount,
    pi.due_date,
    pi.status,
    pi.created_at
FROM payment_installments pi
ORDER BY pi.created_at DESC
LIMIT 10;
