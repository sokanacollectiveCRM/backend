-- Examine payment-related tables structure

-- Payment Schedules
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_schedules'
ORDER BY ordinal_position;

-- Contract Payments
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'contract_payments'
ORDER BY ordinal_position;

-- Payment Methods
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_methods'
ORDER BY ordinal_position;

-- Charges
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'charges'
ORDER BY ordinal_position;

-- Invoices
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- QuickBooks Invoices
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'quickbooks_invoices'
ORDER BY ordinal_position;

-- Contracts (for payment-related fields)
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'contracts'
ORDER BY ordinal_position;

-- Show sample data from payment_schedules
SELECT * FROM payment_schedules LIMIT 5;

-- Show sample data from contract_payments
SELECT * FROM contract_payments LIMIT 5;

-- Show sample data from payment_methods
SELECT * FROM payment_methods LIMIT 5;

-- Show sample data from charges
SELECT * FROM charges LIMIT 5;

-- Show sample data from invoices
SELECT * FROM invoices LIMIT 5;
