-- Fix customers table schema
-- Add missing id column if it doesn't exist
DO $$
BEGIN
    -- Check if id column exists, if not add it
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'id'
    ) THEN
        ALTER TABLE customers ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
    END IF;

    -- Check if other required columns exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE customers ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE;
    END IF;

    -- Add created_at and updated_at if they don't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE customers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Show the current customers table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
