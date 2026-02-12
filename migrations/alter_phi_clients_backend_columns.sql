-- Backend alignment: add columns to phi_clients expected by the Express app (sokana_private).
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS not in all PG versions; use DO block).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'status') THEN
    ALTER TABLE public.phi_clients ADD COLUMN status text DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'service_needed') THEN
    ALTER TABLE public.phi_clients ADD COLUMN service_needed text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'portal_status') THEN
    ALTER TABLE public.phi_clients ADD COLUMN portal_status text DEFAULT 'not_invited';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'user_id') THEN
    ALTER TABLE public.phi_clients ADD COLUMN user_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'requested_at') THEN
    ALTER TABLE public.phi_clients ADD COLUMN requested_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'invited_at') THEN
    ALTER TABLE public.phi_clients ADD COLUMN invited_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'last_invite_sent_at') THEN
    ALTER TABLE public.phi_clients ADD COLUMN last_invite_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'invite_sent_count') THEN
    ALTER TABLE public.phi_clients ADD COLUMN invite_sent_count integer DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN public.phi_clients.user_id IS 'Links to Supabase auth.users.id for authentication';
COMMENT ON COLUMN public.phi_clients.status IS 'Operational: pending, active, inactive';
COMMENT ON COLUMN public.phi_clients.portal_status IS 'Portal invite state: not_invited, invited, active, disabled';
