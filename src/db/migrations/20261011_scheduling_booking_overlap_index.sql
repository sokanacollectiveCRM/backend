-- Additive index for pilot scheduling overlap checks.
-- Safe to run multiple times. No destructive SQL.

CREATE INDEX IF NOT EXISTS idx_doula_booking_requests_overlap
  ON public.doula_booking_requests (doula_id, start_at, end_at)
  WHERE status IN ('pending', 'approved');
