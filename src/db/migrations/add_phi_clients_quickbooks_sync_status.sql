-- BILL-15: Persist the last on-demand QuickBooks customer verification result.
-- Verification is triggered by the API; this migration does not install a cron job.
ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS quickbooks_sync_status text NOT NULL DEFAULT 'not_linked',
  ADD COLUMN IF NOT EXISTS quickbooks_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_sync_error text;

UPDATE public.phi_clients
SET quickbooks_sync_status = CASE
  WHEN qbo_customer_id IS NULL THEN 'not_linked'
  ELSE 'link_stale'
END
WHERE quickbooks_last_checked_at IS NULL;

ALTER TABLE public.phi_clients
  DROP CONSTRAINT IF EXISTS phi_clients_quickbooks_sync_status_check;

ALTER TABLE public.phi_clients
  ADD CONSTRAINT phi_clients_quickbooks_sync_status_check
  CHECK (quickbooks_sync_status IN ('linked', 'not_linked', 'link_stale', 'sync_failed', 'syncing'));

CREATE INDEX IF NOT EXISTS phi_clients_quickbooks_sync_status_idx
  ON public.phi_clients (quickbooks_sync_status);
