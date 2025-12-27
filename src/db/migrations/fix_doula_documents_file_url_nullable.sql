-- Fix doula_documents table to allow NULL file_url
-- Since we're migrating to file_path, file_url should be nullable
-- Run this in Supabase SQL Editor

-- Step 1: Make file_url nullable (drop NOT NULL constraint)
ALTER TABLE doula_documents
ALTER COLUMN file_url DROP NOT NULL;

-- Step 2: Ensure file_path column exists
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
