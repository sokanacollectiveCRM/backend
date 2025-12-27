-- Fix doula_documents table to support file_path migration
-- This makes file_url nullable and ensures file_path exists
-- Run this in Supabase SQL Editor

-- Step 1: Make file_url nullable (drop NOT NULL constraint)
-- This allows new records to be inserted with only file_path
ALTER TABLE doula_documents
ALTER COLUMN file_url DROP NOT NULL;

-- Step 2: Ensure file_path column exists (nullable)
ALTER TABLE doula_documents
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Step 3: Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'doula_documents'
  AND column_name IN ('file_url', 'file_path')
ORDER BY column_name;

-- Step 4: Check current data state
SELECT
  COUNT(*) as total_records,
  COUNT(file_path) as records_with_file_path,
  COUNT(file_url) as records_with_file_url
FROM doula_documents;
