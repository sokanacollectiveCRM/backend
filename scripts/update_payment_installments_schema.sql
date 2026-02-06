-- Add missing columns to payment_installments table
ALTER TABLE payment_installments
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have updated_at timestamp
UPDATE payment_installments
SET updated_at = NOW()
WHERE updated_at IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_payment_installments_stripe_id
ON payment_installments(stripe_payment_intent_id);

-- Verify the schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_installments'
ORDER BY ordinal_position;
