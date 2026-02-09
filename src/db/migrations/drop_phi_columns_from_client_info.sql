-- ============================================================================
-- DROP PHI COLUMNS FROM client_info (Supabase)
-- ============================================================================
-- These columns should ONLY exist in sokana-private (phi_clients table).
-- Having them in Supabase creates accidental PHI exposure risk via SELECT *.
--
-- PREREQUISITES:
-- 1. Verify no code paths write to these columns in Supabase
--    (the split-write controller routes PHI to broker, not Supabase)
-- 2. Verify no queries SELECT these columns from client_info
--    (lite queries now use explicit column lists)
-- 3. Back up data if any values exist (they may have been populated pre-split)
--
-- Run this AFTER confirming all backend paths use split writes.
-- ============================================================================

-- CLINICAL PHI — safe to drop (code already returns '' for these)
ALTER TABLE public.client_info DROP COLUMN IF EXISTS health_history;
ALTER TABLE public.client_info DROP COLUMN IF EXISTS health_notes;
ALTER TABLE public.client_info DROP COLUMN IF EXISTS allergies;
ALTER TABLE public.client_info DROP COLUMN IF EXISTS due_date;
ALTER TABLE public.client_info DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.client_info DROP COLUMN IF EXISTS hospital;

-- ADDRESS FIELDS — PHI per HIPAA when combined with health data.
-- Drop these ONLY if broker handles all address writes.
-- Uncomment when ready:
-- ALTER TABLE public.client_info DROP COLUMN IF EXISTS address;
-- ALTER TABLE public.client_info DROP COLUMN IF EXISTS city;
-- ALTER TABLE public.client_info DROP COLUMN IF EXISTS state;
-- ALTER TABLE public.client_info DROP COLUMN IF EXISTS country;
-- ALTER TABLE public.client_info DROP COLUMN IF EXISTS zip_code;

-- IDENTITY FIELDS — first_name, last_name, email, phone_number
-- These are PHI but are kept as a display cache for the list endpoint.
-- DO NOT DROP until list endpoint uses display_name/client_code aliases.
-- See: updateIdentityCache() in supabaseClientRepository.ts

-- ============================================================================
-- VERIFY after running:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'client_info' AND table_schema = 'public'
-- ORDER BY ordinal_position;
-- ============================================================================
