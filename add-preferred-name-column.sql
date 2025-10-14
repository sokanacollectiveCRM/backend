-- Add preferred_name column to client_info table if it doesn't exist
-- Run this in Supabase SQL Editor

ALTER TABLE client_info
ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(255);

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_info'
AND column_name = 'preferred_name';
