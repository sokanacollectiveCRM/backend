-- Create Test Doula User in Supabase
-- Run this in Supabase SQL Editor
--
-- This script creates:
-- 1. An auth user in auth.users (via Supabase Auth Admin API)
-- 2. A corresponding user record in the users table with role='doula'
--
-- IMPORTANT: You need to use Supabase's auth.admin.createUser() function
-- OR create the user through the Supabase Dashboard Auth section first,
-- then run the second part of this script to create the users table record.

-- ============================================================================
-- OPTION 1: Create via Supabase Dashboard (Recommended)
-- ============================================================================
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" > "Create new user"
-- 3. Enter:
--    - Email: doula@test.com (or your test email)
--    - Password: doula123 (or your test password)
--    - Auto Confirm User: Yes
-- 4. Copy the User ID (UUID) that gets created
-- 5. Then run the INSERT statement below with that UUID

-- ============================================================================
-- OPTION 2: Create via SQL (Requires Supabase Auth Extension)
-- ============================================================================
-- Note: This requires the auth schema to be accessible, which may not work
-- in all Supabase setups. If this doesn't work, use Option 1.

-- First, create the auth user (this may not work - use Option 1 if it fails)
DO $$
DECLARE
  new_user_id UUID;
  user_email TEXT := 'jerry@techluminateacademy.com';
  user_password TEXT := '@Bony5690';
BEGIN
  -- Try to create auth user (this might not work - use Dashboard if it fails)
  -- The password will be hashed automatically
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')), -- Hash the password
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"doula"}',
    false,
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create the user record in users table
  INSERT INTO users (
    id,
    email,
    firstname,
    lastname,
    role,
    created_at,
    updated_at
  )   VALUES (
    new_user_id,
    user_email,
    'Jerry',
    'Bony',
    'doula',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    firstname = EXCLUDED.firstname,
    lastname = EXCLUDED.lastname,
    role = EXCLUDED.role,
    updated_at = NOW();

  RAISE NOTICE 'User created with ID: %', new_user_id;
END $$;

-- ============================================================================
-- OPTION 3: Manual Insert (After creating auth user via Dashboard)
-- ============================================================================
-- If you created the auth user via Dashboard, use this:
-- Replace 'YOUR_AUTH_USER_ID_HERE' with the UUID from the Dashboard

/*
INSERT INTO users (
  id,
  email,
  firstname,
  lastname,
  role,
  created_at,
  updated_at
) VALUES (
  'YOUR_AUTH_USER_ID_HERE',  -- Replace with actual UUID from auth.users
  'jerry@techluminateacademy.com',
  'Jerry',
  'Bony',
  'doula',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  firstname = EXCLUDED.firstname,
  lastname = EXCLUDED.lastname,
  role = EXCLUDED.role,
  updated_at = NOW();
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if user was created in auth.users
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data->>'role' as role_metadata
FROM auth.users
WHERE email = 'jerry@techluminateacademy.com';

-- Check if user was created in users table
SELECT
  id,
  email,
  firstname,
  lastname,
  role,
  created_at
FROM users
WHERE email = 'jerry@techluminateacademy.com';

-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================
-- To delete the test user (run in order):

-- 1. Delete from users table
-- DELETE FROM users WHERE email = 'jerry@techluminateacademy.com';

-- 2. Delete from auth.users (use Supabase Dashboard > Authentication > Users)
-- OR if you have admin access:
-- DELETE FROM auth.users WHERE email = 'jerry@techluminateacademy.com';
