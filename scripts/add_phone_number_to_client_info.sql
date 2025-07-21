-- Add phone_number column to client_info table
-- Run this in your Supabase SQL editor

-- Add phone_number column to client_info table
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_info' 
AND column_name = 'phone_number';

-- Show all columns in client_info table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_info'
ORDER BY ordinal_position; 