-- Migration: Add file_path column to doula_documents table
-- This migration adds support for storing file paths instead of URLs
-- for private storage buckets that require signed URLs

-- Step 1: Add file_path column (nullable initially for migration)
ALTER TABLE doula_documents
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Step 2: Migrate existing file_url data to file_path
-- Extract path from existing URLs
-- URL format: https://{project}.supabase.co/storage/v1/object/public/doula-documents/{path}
UPDATE doula_documents
SET file_path = SUBSTRING(
  file_url FROM '/doula-documents/(.*)$'
)
WHERE file_path IS NULL
  AND file_url IS NOT NULL
  AND file_url LIKE '%/doula-documents/%';

-- Alternative: If the above doesn't work, try this pattern:
-- Extract everything after the last '/doula-documents/'
UPDATE doula_documents
SET file_path = REGEXP_REPLACE(
  file_url,
  '^.*/doula-documents/',
  ''
)
WHERE file_path IS NULL
  AND file_url IS NOT NULL
  AND file_url LIKE '%/doula-documents/%';

-- Step 3: Verify migration
-- Check how many records were migrated
SELECT
  COUNT(*) as total_records,
  COUNT(file_path) as records_with_path,
  COUNT(file_url) as records_with_url,
  COUNT(CASE WHEN file_path IS NULL AND file_url IS NOT NULL THEN 1 END) as unmigrated
FROM doula_documents;

-- Step 4: (Optional) After verifying migration, you can make file_path required
-- Uncomment the following lines after verifying all records are migrated:
-- ALTER TABLE doula_documents
-- ALTER COLUMN file_path SET NOT NULL;

-- Step 5: (Optional) After verifying everything works, you can drop file_url column
-- Uncomment the following line only after confirming the new system works:
-- ALTER TABLE doula_documents DROP COLUMN file_url;
