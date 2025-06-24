-- Add stripe_customer_id column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS customers_stripe_customer_id_idx 
ON customers(stripe_customer_id); 