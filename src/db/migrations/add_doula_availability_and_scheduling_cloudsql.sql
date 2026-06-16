-- Add scheduling link support plus doula availability and booking-request tables.
-- Safe to run multiple times.

ALTER TABLE public.doulas
ADD COLUMN IF NOT EXISTS scheduling_url text;

CREATE TABLE IF NOT EXISTS public.doula_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doula_id uuid NOT NULL REFERENCES public.doulas(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  availability_status text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT doula_availability_valid_range CHECK (start_at < end_at),
  CONSTRAINT doula_availability_status_check CHECK (availability_status IN ('available', 'unavailable'))
);

CREATE INDEX IF NOT EXISTS idx_doula_availability_doula_id
  ON public.doula_availability (doula_id);

CREATE INDEX IF NOT EXISTS idx_doula_availability_window
  ON public.doula_availability (doula_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS public.doula_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  doula_id uuid NOT NULL REFERENCES public.doulas(id) ON DELETE CASCADE,
  requested_by uuid,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT doula_booking_requests_valid_range CHECK (start_at < end_at),
  CONSTRAINT doula_booking_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_doula_booking_requests_client_id
  ON public.doula_booking_requests (client_id);

CREATE INDEX IF NOT EXISTS idx_doula_booking_requests_doula_id
  ON public.doula_booking_requests (doula_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_doula_availability_updated_at ON public.doula_availability;
CREATE TRIGGER trigger_doula_availability_updated_at
  BEFORE UPDATE ON public.doula_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_doula_booking_requests_updated_at ON public.doula_booking_requests;
CREATE TRIGGER trigger_doula_booking_requests_updated_at
  BEFORE UPDATE ON public.doula_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();
