-- ============================================================================
-- STEP 1: client_info table (operational data only - NO PHI)
-- ============================================================================
-- HIPAA Compliance:
-- - service_needed MUST be category-only (birth_support, postpartum, etc.)
--   NOT free-text notes that could contain medical info
-- - No GRANT to authenticated - server-only access via service_role
-- - PHI (health_history, due_date, etc.) belongs in Sensitive DB only
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to auth/users if applicable (keep ONE linkage strategy)
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Basic info (non-PHI operational identifiers)
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone_number TEXT,

  -- Workflow status (operational)
  status TEXT NOT NULL DEFAULT 'pending',
  service_needed TEXT, -- MUST be category-only, not free text notes
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Portal fields (operational)
  portal_status TEXT NOT NULL DEFAULT 'not_invited',
  invited_at TIMESTAMPTZ,
  last_invite_sent_at TIMESTAMPTZ,
  invite_sent_count INTEGER NOT NULL DEFAULT 0,
  invited_by UUID,
  last_login_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.client_info ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (server-only access)
CREATE POLICY "service_role_full_access" ON public.client_info
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_info_user_id ON public.client_info(user_id);
CREATE INDEX IF NOT EXISTS idx_client_info_status ON public.client_info(status);

-- Optional: partial unique indexes to reduce duplicates without blocking NULLs
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_info_email
  ON public.client_info (email)
  WHERE email IS NOT NULL;

-- NOTE: phone uniqueness is often messy; only enforce if you're sure
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_client_info_phone
--   ON public.client_info (phone_number)
--   WHERE phone_number IS NOT NULL;

-- Permissions: server-only. Do NOT grant authenticated broad access.
REVOKE ALL ON public.client_info FROM authenticated;
GRANT ALL ON public.client_info TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_info_updated_at ON public.client_info;
CREATE TRIGGER trg_client_info_updated_at
BEFORE UPDATE ON public.client_info
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Test row
INSERT INTO public.client_info (first_name, last_name, email, status, service_needed)
VALUES ('Test', 'Client', 'test@example.com', 'active', 'birth_support')
ON CONFLICT (email) DO NOTHING;
