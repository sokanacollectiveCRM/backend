-- Retain QuickBooks token records when refresh fails and expose safe health metadata.
ALTER TABLE public.quickbooks_tokens
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS last_refresh_error text,
  ADD COLUMN IF NOT EXISTS last_refresh_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_refresh_succeeded_at timestamptz;

ALTER TABLE public.quickbooks_tokens
  DROP CONSTRAINT IF EXISTS quickbooks_tokens_connection_status_check;

ALTER TABLE public.quickbooks_tokens
  ADD CONSTRAINT quickbooks_tokens_connection_status_check
  CHECK (connection_status IN ('connected', 'refresh_failed', 'reauthorization_required'));
