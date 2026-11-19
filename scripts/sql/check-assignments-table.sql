-- Check if assignments table exists and its structure
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'assignments';

-- Get all columns in the assignments table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'assignments'
ORDER BY ordinal_position;

-- Check for indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'assignments';

-- Check for foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'assignments'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Sample data (if any)
SELECT *
FROM assignments
LIMIT 5;
