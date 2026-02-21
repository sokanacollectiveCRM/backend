-- Cloud SQL admin profiles table (linked to Supabase Auth users by id).
-- Safe to run multiple times.
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins (email);
