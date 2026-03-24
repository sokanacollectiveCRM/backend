DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'client_documents'
  ) THEN
    CREATE TABLE public.client_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
      document_type VARCHAR(50) NOT NULL,
      category VARCHAR(50),
      file_name VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(100),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT client_documents_document_type_check
        CHECK (document_type IN ('insurance_card')),
      CONSTRAINT client_documents_status_check
        CHECK (status IN ('uploaded'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_documents_client_id
  ON public.client_documents (client_id);

CREATE INDEX IF NOT EXISTS idx_client_documents_document_type
  ON public.client_documents (document_type);

CREATE OR REPLACE FUNCTION public.update_client_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_documents_updated_at ON public.client_documents;

CREATE TRIGGER trigger_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_documents_updated_at();

COMMENT ON TABLE public.client_documents IS 'Client-uploaded document metadata stored in Cloud SQL; file bytes remain in Supabase Storage.';
