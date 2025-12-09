-- Fix RLS policies for assignments table
-- This allows admins to create assignments and doulas to view their own assignments

-- Drop ALL existing policies if they exist (comprehensive cleanup)
-- This ensures the migration can be run multiple times safely
DROP POLICY IF EXISTS "Admins can do everything on assignments" ON assignments;
DROP POLICY IF EXISTS "Doulas can view their own assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON assignments;
DROP POLICY IF EXISTS "Doulas can view own assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON assignments;

-- Create a SECURITY DEFINER function to check if user is admin
-- This function can access both auth.users and public.users tables
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user (auth.uid()) has admin role in public.users
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Create a SECURITY DEFINER function to check if user is doula
CREATE OR REPLACE FUNCTION is_doula_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user (auth.uid()) has doula role in public.users
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'doula'
  );
END;
$$;

-- Policy: Admins can SELECT all assignments
CREATE POLICY "Admins can view all assignments"
ON assignments
FOR SELECT
TO authenticated
USING (is_admin_user());

-- Policy: Admins can INSERT assignments
CREATE POLICY "Admins can insert assignments"
ON assignments
FOR INSERT
TO authenticated
WITH CHECK (is_admin_user());

-- Policy: Admins can UPDATE assignments
CREATE POLICY "Admins can update assignments"
ON assignments
FOR UPDATE
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- Policy: Admins can DELETE assignments
CREATE POLICY "Admins can delete assignments"
ON assignments
FOR DELETE
TO authenticated
USING (is_admin_user());

-- Policy: Doulas can view their own assignments
CREATE POLICY "Doulas can view own assignments"
ON assignments
FOR SELECT
TO authenticated
USING (
  doula_id = auth.uid()
  OR is_admin_user() -- Admins can also view
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON assignments TO authenticated;

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'assignments'
ORDER BY policyname;
