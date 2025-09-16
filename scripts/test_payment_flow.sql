-- Test Payment Flow from Contract to Payment Tracking

-- Step 1: Create a test contract
INSERT INTO contracts (
    id,
    client_id,
    status,
    fee,
    deposit
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM client_info LIMIT 1),  -- Use existing client
    'active',
    '$2,500.00',
    '$500.00'
) RETURNING id as contract_id;

-- Step 2: Create payment schedule for the contract
INSERT INTO payment_schedules (
    id,
    contract_id,
    schedule_name,
    total_amount,
    deposit_amount,
    installment_amount,
    number_of_installments,
    payment_frequency,
    start_date,
    end_date,
    status
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM contracts ORDER BY created_at DESC LIMIT 1),
    'Test Payment Plan',
    2500.00,
    500.00,
    500.00,  -- (2500 - 500) / 4 installments
    4,
    'monthly',
    CURRENT_DATE + INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '5 months',
    'active'
) RETURNING id as schedule_id;

-- Step 3: Generate installments
SELECT generate_payment_installments(
    (SELECT id FROM payment_schedules ORDER BY created_at DESC LIMIT 1),
    CURRENT_DATE + INTERVAL '30 days',
    'monthly',
    4
);

-- Step 4: Create invoices for each installment
DO $$
DECLARE
    installment_record RECORD;
    invoice_id UUID;
BEGIN
    FOR installment_record IN
        SELECT id, amount, due_date
        FROM payment_installments
        WHERE schedule_id = (SELECT id FROM payment_schedules ORDER BY created_at DESC LIMIT 1)
    LOOP
        -- Create invoice
        INSERT INTO invoices (
            id,
            customer_id,
            line_items,
            due_date,
            memo,
            status,
            doc_number,
            total_amount,
            balance
        ) VALUES (
            gen_random_uuid(),
            (SELECT id FROM client_info LIMIT 1),
            jsonb_build_array(
                jsonb_build_object(
                    'Id', '1',
                    'Amount', installment_record.amount,
                    'LineNum', 1,
                    'DetailType', 'SalesItemLineDetail',
                    'Description', 'Monthly Payment',
                    'SalesItemLineDetail', jsonb_build_object(
                        'Qty', 1,
                        'ItemRef', jsonb_build_object(
                            'name', 'Monthly Payment',
                            'value', '20'
                        ),
                        'UnitPrice', installment_record.amount,
                        'TaxCodeRef', jsonb_build_object(
                            'value', 'NON'
                        ),
                        'ItemAccountRef', jsonb_build_object(
                            'name', 'Services',
                            'value', '1'
                        )
                    )
                )
            ),
            installment_record.due_date,
            'Monthly Payment',
            'pending',
            'TEST-' || extract(epoch from now())::text,
            installment_record.amount::text,
            installment_record.amount::text
        ) RETURNING id INTO invoice_id;

        -- Link installment to invoice
        UPDATE payment_installments
        SET invoice_id = invoice_id
        WHERE id = installment_record.id;
    END LOOP;
END $$;

-- Step 5: Show the complete payment flow
SELECT
    c.id as contract_id,
    c.fee,
    c.deposit,
    ps.schedule_name,
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
FROM contracts c
JOIN payment_schedules ps ON c.id = ps.contract_id
LEFT JOIN payment_installments pi ON ps.id = pi.schedule_id
LEFT JOIN invoices i ON pi.invoice_id = i.id
WHERE c.id = (SELECT id FROM contracts ORDER BY created_at DESC LIMIT 1)
ORDER BY pi.due_date;

-- Step 6: Show payment summary
SELECT
    ps.id as schedule_id,
    ps.total_amount,
    ps.remaining_balance,
    COUNT(pi.id) as total_installments,
    COUNT(pi.id) FILTER (WHERE pi.status = 'paid') as paid_installments,
    COUNT(pi.id) FILTER (WHERE pi.status = 'pending') as pending_installments,
    SUM(pi.amount) FILTER (WHERE pi.status = 'paid') as total_paid,
    SUM(pi.amount) FILTER (WHERE pi.status = 'pending') as total_due
FROM payment_schedules ps
LEFT JOIN payment_installments pi ON ps.id = pi.schedule_id
WHERE ps.id = (SELECT id FROM payment_schedules ORDER BY created_at DESC LIMIT 1)
GROUP BY ps.id, ps.total_amount, ps.remaining_balance;
