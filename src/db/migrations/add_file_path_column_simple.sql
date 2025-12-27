-- Simple migration: Add file_path column to doula_documents table
-- This adds the column needed by the repository code
-- Run this in Supabase SQL Editor

-- Step 1: Add file_path column (nullable, since existing records won't have it initially)
ALTER TABLE doula_documents
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Step 2: Verify the column was added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'doula_documents'
  AND column_name = 'file_path';

-- Step 3: Check current state (should show file_path as NULL for existing records)
SELECT
  id,
  file_name,
  file_url,
  file_path,
  created_at
FROM doula_documents
ORDER BY created_at DESC
LIMIT 5;
