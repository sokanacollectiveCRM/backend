-- View complete payment schedule with all installments

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
WHERE ps.contract_id IN ('31cd8120-05d4-4ba7-a710-2f84db82796b', 'ec81fc2a-7ba1-43b6-baf1-56f11e37c911')
ORDER BY ps.created_at DESC;

-- Show all installments for these contracts
SELECT
    ps.contract_id,
    ps.deposit_due_date,
    ps.deposit_amount,
    'Deposit' as payment_type,
    ps.deposit_amount as amount,
    ps.deposit_due_date as due_date,
    'pending' as status
FROM payment_schedules ps
WHERE ps.contract_id IN ('31cd8120-05d4-4ba7-a710-2f84db82796b', 'ec81fc2a-7ba1-43b6-baf1-56f11e37c911')

UNION ALL

SELECT
    ps.contract_id,
    ps.deposit_due_date,
    ps.deposit_amount,
    'Installment ' || ROW_NUMBER() OVER (PARTITION BY ps.contract_id ORDER BY pi.due_date) as payment_type,
    pi.amount,
    pi.due_date,
    pi.status
FROM payment_schedules ps
JOIN payment_installments pi ON ps.id = pi.schedule_id
WHERE ps.contract_id IN ('31cd8120-05d4-4ba7-a710-2f84db82796b', 'ec81fc2a-7ba1-43b6-baf1-56f11e37c911')

ORDER BY contract_id, due_date;
