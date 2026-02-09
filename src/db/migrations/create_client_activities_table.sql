-- Create client_activities table for activity/notes tracking per client.
-- Used by GET /clients/:id/activities and POST /clients/:id/activity.
-- Schema matches SupabaseActivityRepository (type, description, timestamp, created_by).

CREATE TABLE IF NOT EXISTS public.client_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_info(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  description text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON public.client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_timestamp ON public.client_activities(timestamp DESC);

COMMENT ON TABLE public.client_activities IS 'Activity/notes log per client (notes, calls, etc.)';
