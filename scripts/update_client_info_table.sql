-- Update client_info table to include all 10-step form fields
-- Run this in your Supabase SQL editor

-- Add missing fields for Step 1: Client Details
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS pronouns_other VARCHAR(100);

-- Add missing fields for Step 2: Home Details
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS home_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS home_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS home_access TEXT,
ADD COLUMN IF NOT EXISTS pets TEXT;

-- Add missing fields for Step 3: Family Members
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS relationship_status VARCHAR(100),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS work_phone VARCHAR(20);

-- Add missing fields for Step 4: Referral
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS referral_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS referral_email VARCHAR(255);

-- Add missing fields for Step 5: Health History
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS health_notes TEXT;

-- Add missing fields for Step 7: Pregnancy/Baby
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS birth_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS birth_hospital VARCHAR(255),
ADD COLUMN IF NOT EXISTS number_of_babies INTEGER,
ADD COLUMN IF NOT EXISTS baby_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS pregnancy_number INTEGER;

-- Add missing fields for Step 8: Past Pregnancies
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS had_previous_pregnancies BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS previous_pregnancies_count INTEGER,
ADD COLUMN IF NOT EXISTS living_children_count INTEGER,
ADD COLUMN IF NOT EXISTS past_pregnancy_experience TEXT;

-- Add missing fields for Step 9: Services Interested
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS services_interested TEXT[],
ADD COLUMN IF NOT EXISTS service_support_details TEXT;

-- Add missing fields for Step 10: Client Demographics (Optional)
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS race_ethnicity VARCHAR(255),
ADD COLUMN IF NOT EXISTS primary_language VARCHAR(100),
ADD COLUMN IF NOT EXISTS client_age_range VARCHAR(50),
ADD COLUMN IF NOT EXISTS insurance VARCHAR(255),
ADD COLUMN IF NOT EXISTS demographics_multi TEXT[];

-- Add system fields for better management
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_info_email ON client_info(email);
CREATE INDEX IF NOT EXISTS idx_client_info_status ON client_info(status);
CREATE INDEX IF NOT EXISTS idx_client_info_user_id ON client_info(user_id);

-- Enable Row Level Security if not already enabled
ALTER TABLE client_info ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user access
CREATE POLICY IF NOT EXISTS "Users can view own client info" ON client_info
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own client info" ON client_info
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own client info" ON client_info
    FOR UPDATE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_client_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_info_updated_at 
    BEFORE UPDATE ON client_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_client_info_updated_at();

-- Verify the changes
SELECT 
    'client_info table updated successfully' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'client_info';

-- Show the updated table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_info'
ORDER BY ordinal_position; 