-- Simple inspection script for doula_documents schema
-- Run each section separately in Supabase SQL Editor

-- 1. List all columns in the table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'doula_documents'
ORDER BY ordinal_position;

-- 2. Check total record count
SELECT COUNT(*) as total_records FROM doula_documents;

-- 3. Sample records (this will show what columns actually have data)
SELECT * FROM doula_documents ORDER BY created_at DESC LIMIT 3;
