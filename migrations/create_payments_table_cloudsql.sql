-- Cloud SQL: payments table for Stripe charges and financial list (GET /api/payments).
-- Run this in your Cloud SQL database (e.g. sokana_private) if the table does not exist.
-- Backend: listPaymentsFromCloudSql, insertPaymentToCloudSql (Stripe charge).

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  txn_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  amount NUMERIC(12, 2) NOT NULL,
  method VARCHAR(50),
  gateway VARCHAR(50),
  transaction_id VARCHAR(255),
  client_id UUID,
  -- Optional: link to invoice/contract for UI and reconciliation
  invoice_id BIGINT,
  invoice VARCHAR(255),
  contract_id UUID,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_txn_date ON payments(txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

COMMENT ON TABLE payments IS 'Payment records (Stripe charges, etc.). Source for GET /api/payments and reconciliation.';
