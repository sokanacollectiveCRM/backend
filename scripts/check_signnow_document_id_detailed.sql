-- Detailed script to check SignNow document IDs in contracts table
-- This will show all contracts with their details

SELECT
    c.id as contract_id,
    c.signnow_document_id,
    c.client_id,
    c.status,
    c.fee,
    c.deposit,
    c.created_at,
    ci.firstname || ' ' || ci.lastname as client_name,
    ci.email as client_email
FROM contracts c
LEFT JOIN client_info ci ON c.client_id = ci.id
ORDER BY c.created_at DESC;

-- Also check if the signnow_document_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contracts'
AND column_name = 'signnow_document_id';
