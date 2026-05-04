-- Add lifecycle tracking fields for Lead → Customer conversion.
-- matched_at: timestamp when the client was first marked as "matched"
-- qbo_customer_id: QuickBooks Online customer ID, set at conversion time

ALTER TABLE phi_clients
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qbo_customer_id TEXT;

CREATE INDEX IF NOT EXISTS phi_clients_qbo_customer_id_idx ON phi_clients (qbo_customer_id)
  WHERE qbo_customer_id IS NOT NULL;

COMMENT ON COLUMN phi_clients.matched_at IS 'Timestamp when the client was first converted from Lead to Customer (status = matched)';
COMMENT ON COLUMN phi_clients.qbo_customer_id IS 'QuickBooks Online customer ID, stored at conversion time for auditing and invoicing';
