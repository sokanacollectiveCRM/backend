-- ============================================================================
-- STEP 1 MINIMAL SETUP - For /clients Testing Only
-- ============================================================================
-- This creates a minimal non-PHI users table for auth lookup.
-- Run this in Supabase SQL Editor to unblock Step 1 testing.
-- ============================================================================

-- Create minimal users table (NO PHI FIELDS)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  firstname TEXT,
  lastname TEXT,
  first_name TEXT,  -- Canonical field name
  last_name TEXT,   -- Canonical field name
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'doula', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  account_status TEXT DEFAULT 'active'
);

-- IMPORTANT: No PHI fields here. No health_history, due_date, etc.
-- Those belong in sensitive_client_info in Cloud SQL only.

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (for backend operations)
CREATE POLICY "Service role bypass" ON public.users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can read their own record
CREATE POLICY "Users read own record" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Staff can read all users (for client list)
CREATE POLICY "Staff read all users" ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'doula')
    )
  );

-- Index for auth lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Grants
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- ============================================================================
-- INSERT TEST ADMIN USER
-- ============================================================================
-- This links your auth.users record to the public.users table
INSERT INTO public.users (id, email, firstname, lastname, first_name, last_name, role)
VALUES (
  '528e4d28-b24a-47f1-a66b-d7ddd507b7b9',
  'jerrybony5@gmail.com',
  'Jerry',
  'Bony',
  'Jerry',
  'Bony',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  firstname = EXCLUDED.firstname,
  lastname = EXCLUDED.lastname,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  updated_at = NOW();

-- ============================================================================
-- VERIFY
-- ============================================================================
-- SELECT id, email, role FROM public.users WHERE email = 'jerrybony5@gmail.com';
