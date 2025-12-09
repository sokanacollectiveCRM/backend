-- Simple SQL Script to Create Test Doula User
--
-- PREREQUISITE: You must first create the auth user via Supabase Dashboard
--
-- Steps:
-- 1. Go to Supabase Dashboard > Authentication > Users > Add User
-- 2. Create user with:
--    - Email: jerry@techluminateacademy.com
--    - Password: @Bony5690
--    - Auto Confirm: Yes
-- 3. Copy the User ID (UUID) from the created user
-- 4. Replace 'YOUR_AUTH_USER_ID' below with that UUID
-- 5. Run this script

-- ============================================================================
-- STEP 1: Get the auth user ID (run this first to find the ID)
-- ============================================================================
SELECT
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'jerry@techluminateacademy.com';

-- ============================================================================
-- STEP 2: Insert into users table (replace YOUR_AUTH_USER_ID with ID from Step 1)
-- ============================================================================
INSERT INTO users (
  id,
  email,
  firstname,
  lastname,
  role,
  created_at,
  updated_at
) VALUES (
  'YOUR_AUTH_USER_ID',  -- ⚠️ REPLACE THIS with the UUID from Step 1
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

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
  u.id,
  u.email,
  u.firstname,
  u.lastname,
  u.role,
  u.created_at,
  au.email_confirmed_at as auth_confirmed
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'jerry@techluminateacademy.com';
