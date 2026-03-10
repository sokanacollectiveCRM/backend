-- Migration: Add Mandatory Doula Documents schema support
-- Run in Supabase SQL Editor
-- Adds: reviewed_at, reviewed_by, rejection_reason; document type constraints
-- Required types: background_check, liability_insurance_certificate, training_certificate, w9, direct_deposit_form

-- 1. Add new columns if they don't exist
ALTER TABLE doula_documents
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Ensure file_path exists (may already exist from prior migration)
ALTER TABLE doula_documents
  ADD COLUMN IF NOT EXISTS file_path TEXT;

-- 3. Add check constraint for document_type (allow legacy + new types during migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doula_documents_document_type_check'
  ) THEN
    ALTER TABLE doula_documents
    ADD CONSTRAINT doula_documents_document_type_check
    CHECK (document_type IN (
      'background_check',
      'liability_insurance_certificate',
      'training_certificate',
      'w9',
      'direct_deposit_form',
      'license',
      'other'
    ));
  END IF;
END $$;

-- 4. Migrate existing 'pending' to 'uploaded' for clarity (uploaded = awaiting review)
-- Note: 'missing' is computed when no document exists for a type; not stored
UPDATE doula_documents
SET status = 'uploaded'
WHERE status = 'pending' AND file_path IS NOT NULL;

-- 5. Create index for admin lookups by doula_id + document_type
CREATE INDEX IF NOT EXISTS idx_doula_documents_doula_type
  ON doula_documents(doula_id, document_type);

-- 6. Add comment for documentation
COMMENT ON TABLE doula_documents IS 'Stores doula documents. Required types for active status: background_check, liability_insurance_certificate, training_certificate, w9, direct_deposit_form. Status: missing (computed), uploaded, approved, rejected.';
