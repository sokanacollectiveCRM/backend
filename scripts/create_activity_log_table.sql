-- Create client_activities table for activity tracking
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_info(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_timestamp ON client_activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_client_activities_type ON client_activities(type);

-- Enable Row Level Security
ALTER TABLE client_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for activity access
CREATE POLICY IF NOT EXISTS "Users can view own client activities" ON client_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM client_info 
            WHERE client_info.id = client_activities.client_id 
            AND client_info.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can view all client activities" ON client_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Doulas can view assigned client activities" ON client_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assignments 
            WHERE assignments.client_id = client_activities.client_id 
            AND assignments.doula_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can insert own client activities" ON client_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM client_info 
            WHERE client_info.id = client_activities.client_id 
            AND client_info.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can insert all client activities" ON client_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Verify the table was created successfully
SELECT 
    'client_activities table created successfully' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'client_activities';

-- Show the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_activities'
ORDER BY ordinal_position; 