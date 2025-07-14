-- Request for Service Form Database Migration
-- Run this script in your Supabase SQL editor

-- Create requests table with all fields from the 10-step form
CREATE TABLE IF NOT EXISTS requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Step 1: Client Details
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    pronouns VARCHAR(50),
    pronouns_other VARCHAR(100),
    
    -- Step 2: Home Details
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    home_phone VARCHAR(20),
    home_type VARCHAR(100),
    home_access TEXT,
    pets TEXT,
    
    -- Step 3: Family Members
    relationship_status VARCHAR(100),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    middle_name VARCHAR(255),
    mobile_phone VARCHAR(20),
    work_phone VARCHAR(20),
    
    -- Step 4: Referral
    referral_source VARCHAR(255),
    referral_name VARCHAR(255),
    referral_email VARCHAR(255),
    
    -- Step 5: Health History
    health_history TEXT,
    allergies TEXT,
    health_notes TEXT,
    
    -- Step 6: Payment Info
    annual_income VARCHAR(100),
    service_needed VARCHAR(255) NOT NULL,
    service_specifics TEXT,
    
    -- Step 7: Pregnancy/Baby
    due_date DATE,
    birth_location VARCHAR(255),
    birth_hospital VARCHAR(255),
    number_of_babies INTEGER,
    baby_name VARCHAR(255),
    provider_type VARCHAR(100),
    pregnancy_number INTEGER,
    
    -- Step 8: Past Pregnancies
    had_previous_pregnancies BOOLEAN DEFAULT FALSE,
    previous_pregnancies_count INTEGER,
    living_children_count INTEGER,
    past_pregnancy_experience TEXT,
    
    -- Step 9: Services Interested
    services_interested TEXT[],
    service_support_details TEXT,
    
    -- Step 10: Client Demographics (Optional)
    race_ethnicity VARCHAR(255),
    primary_language VARCHAR(100),
    client_age_range VARCHAR(50),
    insurance VARCHAR(255),
    demographics_multi TEXT[],
    
    -- System fields
    status VARCHAR(50) DEFAULT 'pending',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requests_email ON requests(email);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);

-- Enable Row Level Security
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests" ON requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own requests (if status is pending)
CREATE POLICY "Users can update own pending requests" ON requests
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admins can update all requests
CREATE POLICY "Admins can update all requests" ON requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_requests_updated_at 
    BEFORE UPDATE ON requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the table was created successfully
SELECT 
    'requests table created successfully' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'requests';

-- Show the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'requests'
ORDER BY ordinal_position; 