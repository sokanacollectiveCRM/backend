-- Doula document metadata in Cloud SQL. File bytes stay in GCS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'doula_documents'
  ) THEN
    CREATE TABLE public.doula_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doula_id TEXT NOT NULL,
      document_type VARCHAR(50) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(100),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
      notes TEXT,
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT doula_documents_document_type_check
        CHECK (document_type IN (
          'background_check',
          'liability_insurance_certificate',
          'training_certificate',
          'w9',
          'direct_deposit_form',
          'license',
          'other'
        )),
      CONSTRAINT doula_documents_status_check
        CHECK (status IN ('uploaded', 'approved', 'rejected'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_doula_documents_doula_id
  ON public.doula_documents (doula_id);

CREATE INDEX IF NOT EXISTS idx_doula_documents_doula_type
  ON public.doula_documents (doula_id, document_type);

CREATE OR REPLACE FUNCTION public.update_doula_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_doula_documents_updated_at ON public.doula_documents;

CREATE TRIGGER trigger_doula_documents_updated_at
  BEFORE UPDATE ON public.doula_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_doula_documents_updated_at();

COMMENT ON TABLE public.doula_documents IS
  'Doula document metadata in Cloud SQL. File bytes are in GCS. doula_id is public.doulas.id.';
