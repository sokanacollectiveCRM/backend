-- Script to examine the current contracts table structure
-- This will show us exactly what columns exist so we can create the perfect migration

-- Step 1: Show the current contracts table structure
SELECT 'Current Contracts Table Structure:' as info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    CASE
        WHEN column_name IN ('id', 'client_id', 'template_id', 'generated_by') THEN 'Primary/Reference Key'
        WHEN column_name LIKE '%_id' THEN 'ID Column'
        WHEN column_name LIKE '%_at' OR column_name LIKE '%_date' THEN 'Timestamp/Date'
        WHEN column_name LIKE '%_url' OR column_name LIKE '%_path' THEN 'URL/Path'
        WHEN data_type = 'jsonb' THEN 'JSON Data'
        WHEN column_name LIKE '%status%' THEN 'Status Field'
        ELSE 'Other'
    END as column_type
FROM information_schema.columns
WHERE table_name = 'contracts'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Show foreign key constraints
SELECT 'Foreign Key Constraints:' as info;
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'contracts';

-- Step 3: Show indexes
SELECT 'Indexes on Contracts Table:' as info;
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'contracts'
AND schemaname = 'public';

-- Step 4: Show sample data (first 3 rows)
SELECT 'Sample Data from Contracts Table:' as info;
SELECT * FROM contracts LIMIT 3;

-- Step 5: Count total contracts
SELECT 'Contract Count:' as info;
SELECT COUNT(*) as total_contracts FROM contracts;

-- Step 6: Show data types summary
SELECT 'Data Types Summary:' as info;
SELECT
    data_type,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'contracts'
AND table_schema = 'public'
GROUP BY data_type
ORDER BY column_count DESC;

-- Step 7: Check for related tables
SELECT 'Related Tables (contract_*):' as info;
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name LIKE 'contract%'
AND table_schema = 'public'
ORDER BY table_name;

-- Step 8: Check if client_info table exists and has expected columns
SELECT 'Client Info Table Check:' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_info' AND table_schema = 'public')
        THEN 'client_info table EXISTS'
        ELSE 'client_info table DOES NOT EXIST'
    END as client_info_status;

-- If client_info exists, show its structure
SELECT 'Client Info Table Structure:' as info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'client_info'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 9: Check if users table exists
SELECT 'Users Table Check:' as info;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public')
        THEN 'users table EXISTS'
        ELSE 'users table DOES NOT EXIST'
    END as users_status;

-- Step 10: Summary for migration planning
SELECT 'Migration Planning Summary:' as info;
SELECT
    'contracts' as table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contracts' AND table_schema = 'public') as total_columns,
    (SELECT COUNT(*) FROM contracts) as total_records,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'client_id' AND table_schema = 'public')
        THEN 'HAS client_id column'
        ELSE 'MISSING client_id column'
    END as client_id_status,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'signnow_document_id' AND table_schema = 'public')
        THEN 'HAS signnow_document_id column'
        ELSE 'MISSING signnow_document_id column'
    END as signnow_status,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'generated_by' AND table_schema = 'public')
        THEN 'HAS generated_by column'
        ELSE 'MISSING generated_by column'
    END as generated_by_status;
