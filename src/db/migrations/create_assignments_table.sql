-- Create assignments table for doula-client assignment tracking.
-- Used by: doula assignment endpoints, sensitiveAccess (PHI authorization), and client list filtering.
-- Run this BEFORE fix_assignments_rls.sql.

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_info(id) ON DELETE CASCADE,
  doula_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate active assignments
  UNIQUE (client_id, doula_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assignments_doula_id ON public.assignments(doula_id);
CREATE INDEX IF NOT EXISTS idx_assignments_client_id ON public.assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for backend server operations)
CREATE POLICY "Service role bypass" ON public.assignments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.assignments IS 'Doula-to-client assignment tracking. Used for PHI access authorization.';
