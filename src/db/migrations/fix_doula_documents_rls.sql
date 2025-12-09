-- Fix RLS policies for doula_documents table
-- The issue: doula_id references users(id), but auth.uid() returns auth.users(id)
-- These IDs don't always match, so we need to check if they're the same user
-- Run this in Supabase SQL Editor

-- Create a security definer function to check if doula_id matches auth user
-- This function runs with elevated privileges and can access both tables
CREATE OR REPLACE FUNCTION public.is_doula_owner(doula_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- First check if IDs match directly (common case)
  IF doula_id_param = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- If not, check if emails match
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    JOIN auth.users au ON au.email = u.email
    WHERE u.id = doula_id_param
    AND au.id = auth.uid()
  );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Doulas can view their own documents" ON doula_documents;
DROP POLICY IF EXISTS "Doulas can insert their own documents" ON doula_documents;
DROP POLICY IF EXISTS "Doulas can update their own documents" ON doula_documents;
DROP POLICY IF EXISTS "Doulas can delete their own documents" ON doula_documents;

-- Recreate policies using the security definer function
-- This avoids permission issues when querying the users table
-- Doulas can view their own documents
CREATE POLICY "Doulas can view their own documents"
  ON doula_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_doula_owner(doula_id) OR
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
  WITH CHECK (public.is_doula_owner(doula_id));

-- Doulas can update their own documents
CREATE POLICY "Doulas can update their own documents"
  ON doula_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_doula_owner(doula_id))
  WITH CHECK (public.is_doula_owner(doula_id));

-- Doulas can delete their own documents
CREATE POLICY "Doulas can delete their own documents"
  ON doula_documents
  FOR DELETE
  TO authenticated
  USING (
    public.is_doula_owner(doula_id) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

-- Verify policies
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'doula_documents'
AND schemaname = 'public'
ORDER BY policyname;
