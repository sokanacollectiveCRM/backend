-- Add QuickBooks sync tracking fields to charges table
-- This allows tracking which payments have been synced to QuickBooks

ALTER TABLE charges
ADD COLUMN IF NOT EXISTS qbo_payment_id TEXT,
ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS qb_sync_error TEXT;

-- Create index for faster lookups of sync status
CREATE INDEX IF NOT EXISTS charges_qb_sync_status_idx ON charges(qb_sync_status);

-- Add comments for documentation
COMMENT ON COLUMN charges.qbo_payment_id IS 'QuickBooks payment ID after successful sync';
COMMENT ON COLUMN charges.qb_sync_status IS 'Sync status: pending, synced, or failed';
COMMENT ON COLUMN charges.qb_sync_error IS 'Error message if sync failed';
