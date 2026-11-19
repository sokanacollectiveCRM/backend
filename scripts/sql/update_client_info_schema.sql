-- Add updatedAt column to client_info table
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP DEFAULT NOW();

-- Create trigger to auto-update timestamp on ANY modification
CREATE OR REPLACE FUNCTION update_client_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedAt = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_client_info_updated_at_trigger ON client_info;

-- Create the trigger
CREATE TRIGGER update_client_info_updated_at_trigger 
  BEFORE UPDATE ON client_info 
  FOR EACH ROW 
  EXECUTE FUNCTION update_client_info_updated_at();

-- Optional: Drop the client_activities table since we're not using it
-- DROP TABLE IF EXISTS client_activities;

-- Verify the trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'client_info'
AND trigger_name = 'update_client_info_updated_at_trigger'; 