-- Drop the user_id column from quickbooks_tokens table
ALTER TABLE quickbooks_tokens DROP COLUMN user_id;

-- Drop the unique constraint on user_id
ALTER TABLE quickbooks_tokens DROP CONSTRAINT IF EXISTS quickbooks_tokens_user_id_key; 