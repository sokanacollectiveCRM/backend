-- Placeholder: profiles table (sokana_private).
-- Will hold user/app profiles. Who is in stages of progress and who should have
-- a profile will be decided later; schema can be extended then.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User/app profiles. Criteria for who gets a profile and stages of progress TBD.';
COMMENT ON COLUMN public.profiles.user_id IS 'Supabase auth.users.id';
