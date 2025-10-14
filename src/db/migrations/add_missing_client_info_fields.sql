-- Add missing fields to client_info table for complete profile management
-- This migration adds all the fields that the frontend expects to be able to update

-- Add preferred contact and personal information fields
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
ADD COLUMN IF NOT EXISTS preferred_name TEXT,
ADD COLUMN IF NOT EXISTS home_type TEXT,
ADD COLUMN IF NOT EXISTS home_access TEXT,
ADD COLUMN IF NOT EXISTS pets TEXT,
ADD COLUMN IF NOT EXISTS relationship_status TEXT;

-- Add services and support fields
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS services_interested TEXT[], -- Array of service types
ADD COLUMN IF NOT EXISTS service_support_details TEXT,
ADD COLUMN IF NOT EXISTS service_specifics TEXT;

-- Add health and medical fields
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS health_notes TEXT,
ADD COLUMN IF NOT EXISTS baby_sex TEXT,
ADD COLUMN IF NOT EXISTS baby_name TEXT,
ADD COLUMN IF NOT EXISTS birth_hospital TEXT,
ADD COLUMN IF NOT EXISTS birth_location TEXT,
ADD COLUMN IF NOT EXISTS number_of_babies INTEGER,
ADD COLUMN IF NOT EXISTS provider_type TEXT;

-- Add pregnancy and family fields
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS pregnancy_number INTEGER,
ADD COLUMN IF NOT EXISTS had_previous_pregnancies BOOLEAN,
ADD COLUMN IF NOT EXISTS previous_pregnancies_count INTEGER,
ADD COLUMN IF NOT EXISTS living_children_count INTEGER,
ADD COLUMN IF NOT EXISTS past_pregnancy_experience TEXT;

-- Add demographic and personal details
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS race_ethnicity TEXT,
ADD COLUMN IF NOT EXISTS primary_language TEXT,
ADD COLUMN IF NOT EXISTS client_age_range TEXT,
ADD COLUMN IF NOT EXISTS insurance TEXT,
ADD COLUMN IF NOT EXISTS demographics_multi TEXT[], -- Array of demographics
ADD COLUMN IF NOT EXISTS pronouns_other TEXT;

-- Add contact information fields
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS home_phone TEXT,
ADD COLUMN IF NOT EXISTS mobile_phone TEXT,
ADD COLUMN IF NOT EXISTS work_phone TEXT;

-- Add name variations (for different contexts)
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS middle_name TEXT;

-- Add referral information
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS referral_name TEXT,
ADD COLUMN IF NOT EXISTS referral_email TEXT;

-- Add profile and account fields
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS profile_picture TEXT,
ADD COLUMN IF NOT EXISTS account_status TEXT,
ADD COLUMN IF NOT EXISTS business TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add location fields (if not already present)
ALTER TABLE client_info 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_client_info_preferred_contact_method ON client_info(preferred_contact_method);
CREATE INDEX IF NOT EXISTS idx_client_info_services_interested ON client_info USING GIN(services_interested);
CREATE INDEX IF NOT EXISTS idx_client_info_due_date ON client_info(due_date);
CREATE INDEX IF NOT EXISTS idx_client_info_status ON client_info(status);
CREATE INDEX IF NOT EXISTS idx_client_info_referral_source ON client_info(referral_source);

-- Add comments for documentation
COMMENT ON COLUMN client_info.preferred_contact_method IS 'Preferred method of contact: Phone, Email, Text, Mail';
COMMENT ON COLUMN client_info.preferred_name IS 'Name the client prefers to be called by';
COMMENT ON COLUMN client_info.services_interested IS 'Array of services the client is interested in';
COMMENT ON COLUMN client_info.health_notes IS 'Additional health information and notes';
COMMENT ON COLUMN client_info.demographics_multi IS 'Array of demographic categories the client identifies with';

-- Update the updated_at trigger to include these new fields
-- (This assumes you have an updated_at trigger already)
-- If you don't have one, you can create it:
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_client_info_updated_at ON client_info;
CREATE TRIGGER update_client_info_updated_at 
    BEFORE UPDATE ON client_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
