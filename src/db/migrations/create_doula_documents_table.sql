-- Create doula_documents table for storing doula documents (background checks, licenses, etc.)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS doula_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doula_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'background_check', 'license', 'other'
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- For licenses that expire
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_doula_documents_doula_id ON doula_documents(doula_id);
CREATE INDEX IF NOT EXISTS idx_doula_documents_type ON doula_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_doula_documents_status ON doula_documents(status);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_doula_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_doula_documents_updated_at ON doula_documents;

CREATE TRIGGER trigger_doula_documents_updated_at
  BEFORE UPDATE ON doula_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_doula_documents_updated_at();

-- Enable Row Level Security
ALTER TABLE doula_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: doula_id references users(id), but auth.uid() returns auth.users(id)
-- These IDs may differ, so we match by email to link them

-- Doulas can view their own documents
CREATE POLICY "Doulas can view their own documents"
  ON doula_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      JOIN auth.users ON auth.users.email = public.users.email
      WHERE public.users.id = doula_id
      AND auth.users.id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

-- Doulas can insert their own documents
CREATE POLICY "Doulas can insert their own documents"
  ON doula_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      JOIN auth.users ON auth.users.email = public.users.email
      WHERE public.users.id = doula_id
      AND auth.users.id = auth.uid()
    )
  );

-- Doulas can update their own documents
CREATE POLICY "Doulas can update their own documents"
  ON doula_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      JOIN auth.users ON auth.users.email = public.users.email
      WHERE public.users.id = doula_id
      AND auth.users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      JOIN auth.users ON auth.users.email = public.users.email
      WHERE public.users.id = doula_id
      AND auth.users.id = auth.uid()
    )
  );

-- Doulas can delete their own documents
CREATE POLICY "Doulas can delete their own documents"
  ON doula_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      JOIN auth.users ON auth.users.email = public.users.email
      WHERE public.users.id = doula_id
      AND auth.users.id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

-- Verify the table was created
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'doula_documents'
ORDER BY ordinal_position;
