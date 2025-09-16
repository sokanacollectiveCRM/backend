-- Script to check if SignNow document IDs are being saved to the contracts table
-- This will show all contracts with their SignNow document IDs

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

-- Summary count
SELECT
    COUNT(*) as total_contracts,
    COUNT(signnow_document_id) as contracts_with_signnow_id,
    COUNT(*) - COUNT(signnow_document_id) as contracts_missing_signnow_id
FROM contracts;
