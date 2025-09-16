-- Check the latest payment schedule for the new contract

-- Get the latest payment schedule
SELECT
    ps.contract_id,
    ps.schedule_name,
    ps.total_amount,
    ps.deposit_amount,
    ps.deposit_due_date,
    ps.start_date,
    ps.end_date,
    ps.number_of_installments,
    ps.payment_frequency,
    ps.status,
    ps.created_at
FROM payment_schedules ps
WHERE ps.contract_id = '368aad8e-3fb4-48f9-a200-873d6dd556f9';

-- Show complete payment schedule for this contract
SELECT
    ps.contract_id,
    'Deposit' as payment_type,
    ps.deposit_amount as amount,
    ps.deposit_due_date as due_date,
    'pending' as status
FROM payment_schedules ps
WHERE ps.contract_id = '368aad8e-3fb4-48f9-a200-873d6dd556f9'

UNION ALL

SELECT
    ps.contract_id,
    'Installment ' || ROW_NUMBER() OVER (ORDER BY pi.due_date) as payment_type,
    pi.amount,
    pi.due_date,
    pi.status
FROM payment_schedules ps
JOIN payment_installments pi ON ps.id = pi.schedule_id
WHERE ps.contract_id = '368aad8e-3fb4-48f9-a200-873d6dd556f9'

ORDER BY due_date;
