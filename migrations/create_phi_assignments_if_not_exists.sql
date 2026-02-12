-- Optional: assignments table for doula scoping (sokana_private).
-- Backend uses this to filter clients by doula (findClientsLiteByDoula).
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  doula_id uuid NOT NULL,
  assigned_by uuid,
  status text NOT NULL DEFAULT 'active',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_client_id ON public.assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_doula_id ON public.assignments(doula_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);

COMMENT ON TABLE public.assignments IS 'Doula-client assignments; doula_id links to Supabase auth.users.id';
