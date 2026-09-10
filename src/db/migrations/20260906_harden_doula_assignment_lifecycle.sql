-- Cloud SQL is the sole assignment authorization source.
-- Retain the existing composite key so this migration is safe and reversible;
-- a revoked pair can be reactivated without creating duplicate history rows.

ALTER TABLE public.doula_assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ended_at timestamp without time zone;

UPDATE public.doula_assignments
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'completed', 'cancelled');

ALTER TABLE public.doula_assignments
  DROP CONSTRAINT IF EXISTS doula_assignments_status_check;

ALTER TABLE public.doula_assignments
  ADD CONSTRAINT doula_assignments_status_check
  CHECK (status IN ('active', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_doula_assignments_active_doula
  ON public.doula_assignments (doula_id, client_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_doula_assignments_active_client
  ON public.doula_assignments (client_id, doula_id)
  WHERE status = 'active';
