-- Setup Supabase Storage for Doula Documents
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Create Storage Bucket
-- ============================================================================
-- Note: You may need to create this via Supabase Dashboard > Storage
-- Or use the INSERT statement below if you have access

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doula-documents',
  'doula-documents',
  false, -- Private bucket
  10485760, -- 10MB file size limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Storage Bucket Policies (RLS)
-- ============================================================================

-- Allow authenticated users to upload their own documents
CREATE POLICY "Doulas can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'doula-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own documents
CREATE POLICY "Doulas can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'doula-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own documents
CREATE POLICY "Doulas can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'doula-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to do everything
CREATE POLICY "Admins can manage all doula documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'doula-documents' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'doula-documents' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Note: Service role key should bypass RLS automatically
-- If uploads still fail, ensure the bucket exists and policies are correct

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'doula-documents';

-- Check storage policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%doula%';

