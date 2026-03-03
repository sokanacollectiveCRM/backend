-- Cloud SQL source-of-truth table for client notes/activities.
-- This supports doula endpoints:
--   GET  /api/doulas/clients/:clientId/activities
--   POST /api/doulas/clients/:clientId/activities

CREATE TABLE IF NOT EXISTS public.client_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  created_by uuid NULL,
  type text NOT NULL,
  description text,
  metadata jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON public.client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_timestamp ON public.client_activities(timestamp DESC);
