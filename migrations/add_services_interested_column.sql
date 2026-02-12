-- Add services_interested column to client_info table
-- This column stores the services the client is interested in

-- Add the column (JSONB for flexible array of services)
ALTER TABLE client_info
ADD COLUMN IF NOT EXISTS services_interested JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN client_info.services_interested IS 'Array of services the client is interested in (e.g., ["Birth Support", "Postpartum Support"])';

-- Example values:
-- '["Birth Support"]'
-- '["Birth Support", "Postpartum Support", "Lactation Support"]'
-- '[]' (empty array)

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'client_info'
  AND column_name = 'services_interested';
