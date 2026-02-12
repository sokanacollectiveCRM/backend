-- ============================================
-- STEP 2: Clean Supabase (Keep Auth Only)
-- ============================================
-- Run this in Supabase SQL Editor
-- WARNING: This will delete all client data from Supabase!

-- Drop client data tables (keep auth.users and auth.* tables!)
DROP TABLE IF EXISTS client_activities CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS client_info CASCADE;

-- Verify only auth tables remain
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('public', 'auth')
ORDER BY table_schema, table_name;

-- Expected result: Should show auth.* tables only, public schema should be empty or minimal

-- Check if any client data tables still exist
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Clean! No client data tables in public schema'
    ELSE '❌ WARNING: ' || COUNT(*)::text || ' tables still exist in public schema'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('client_info', 'assignments', 'activities', 'client_activities');
