-- PR P0: public intake rate-limit buckets + idempotency ledger.
-- Additive only. Apply manually (never at app boot).

CREATE TABLE IF NOT EXISTS public.intake_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.intake_idempotency_keys (
  idempotency_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS intake_idempotency_keys_expires_at_idx
  ON public.intake_idempotency_keys (expires_at);
