-- Create the updated_at trigger for client_info table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger
CREATE TRIGGER update_client_info_updated_at
    BEFORE UPDATE ON client_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'client_info'
AND trigger_name = 'update_client_info_updated_at'; 