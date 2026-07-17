-- Read-only verification. Execute with psql -v ON_ERROR_STOP=1 -f <this-file>.
BEGIN TRANSACTION READ ONLY;

SELECT c.id AS client_id, pc.id AS contract_id, ps.id AS schedule_id,
       ps.status AS schedule_status, ps.total_amount AS schedule_total,
       ps.deposit_amount, count(pi.id) AS installment_rows,
       COALESCE(sum(pi.amount),0)::numeric(14,2) AS installment_sum,
       (ps.total_amount-COALESCE(sum(pi.amount),0))::numeric(14,2) AS difference
FROM public.phi_clients c
JOIN public.phi_contracts pc ON pc.client_id=c.id
JOIN public.payment_schedules ps ON ps.contract_id=pc.id
LEFT JOIN public.payment_installments pi ON pi.schedule_id=ps.id
GROUP BY c.id,pc.id,ps.id,ps.status,ps.total_amount,ps.deposit_amount
ORDER BY c.id,pc.id,ps.created_at;

SELECT schedule_id,payment_number,count(*) AS duplicate_count
FROM public.payment_installments WHERE payment_number IS NOT NULL
GROUP BY schedule_id,payment_number HAVING count(*)>1;

SELECT qbo_invoice_id,count(*) AS duplicate_count
FROM public.payment_installments WHERE NULLIF(btrim(qbo_invoice_id),'') IS NOT NULL
GROUP BY qbo_invoice_id HAVING count(*)>1;

SELECT ps.id AS orphaned_schedule_id,ps.contract_id
FROM public.payment_schedules ps LEFT JOIN public.phi_contracts pc ON pc.id=ps.contract_id
WHERE pc.id IS NULL;

SELECT pi.id AS orphaned_installment_id,pi.schedule_id
FROM public.payment_installments pi LEFT JOIN public.payment_schedules ps ON ps.id=pi.schedule_id
WHERE ps.id IS NULL;

ROLLBACK;
