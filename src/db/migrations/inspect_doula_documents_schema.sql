-- Inspect the actual schema of doula_documents table
-- Run this in Supabase SQL Editor
-- This script safely checks which columns exist before querying them

-- ============================================================================
-- STEP 1: Get all columns and their properties
-- ============================================================================
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'doula_documents'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: Check which file-related columns exist
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'doula_documents'
        AND column_name = 'file_path'
    ) THEN 'YES'
    ELSE 'NO'
  END AS has_file_path,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'doula_documents'
        AND column_name = 'file_url'
    ) THEN 'YES'
    ELSE 'NO'
  END AS has_file_url;

-- ============================================================================
-- STEP 3: Sample records (safe - only shows existing columns)
-- ============================================================================
SELECT * FROM doula_documents ORDER BY created_at DESC LIMIT 3;

-- ============================================================================
-- STEP 4: Check data distribution for file_url (if it exists)
-- ============================================================================
SELECT
  COUNT(*) as total_records,
  COUNT(file_url) as records_with_file_url
FROM doula_documents;
