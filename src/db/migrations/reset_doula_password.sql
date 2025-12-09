-- SQL Script to Help Reset Doula User Password
--
-- NOTE: Supabase Auth passwords are encrypted and cannot be reset via SQL.
-- You MUST use one of these methods:
--
-- METHOD 1: Supabase Dashboard (Recommended)
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Find the user by email: jerry@techluminateacademy.com
-- 3. Click on the user
-- 4. Click "Send password reset email" OR "Reset password"
-- 5. Enter new password: @Bony5690
--
-- METHOD 2: Use Supabase Management API
-- Use the admin API to update the password (requires service role key)
--
-- METHOD 3: User Self-Reset
-- The user can use "Forgot Password" on the login page

-- This script only verifies the user exists and shows their current status
SELECT
  u.id,
  u.email,
  u.firstname,
  u.lastname,
  u.role,
  u.account_status,
  au.email_confirmed_at,
  au.created_at as auth_created_at,
  au.last_sign_in_at
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'jerry@techluminateacademy.com';

-- If the user doesn't have role='doula', update it:
UPDATE users
SET
  role = 'doula',
  updated_at = NOW()
WHERE email = 'jerry@techluminateacademy.com'
AND (role IS NULL OR role != 'doula');

-- Verify the update
SELECT
  id,
  email,
  firstname,
  lastname,
  role,
  account_status
FROM users
WHERE email = 'jerry@techluminateacademy.com';
