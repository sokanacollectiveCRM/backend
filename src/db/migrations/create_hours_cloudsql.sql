-- Cloud SQL source-of-truth hours table.
-- Notes are represented by public.client_activities.

CREATE TABLE IF NOT EXISTS public.hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doula_id uuid NOT NULL REFERENCES public.doulas(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hours_doula_id ON public.hours(doula_id);
CREATE INDEX IF NOT EXISTS idx_hours_client_id ON public.hours(client_id);
CREATE INDEX IF NOT EXISTS idx_hours_start_time ON public.hours(start_time DESC);
