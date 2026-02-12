-- ============================================
-- STEP 3-5: Create Fresh Cloud SQL Schema
-- ============================================
-- Run this in Cloud SQL
-- This creates the unified architecture with all data in Cloud SQL

-- Drop existing tables (fresh start)
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- ============================================
-- Create unified clients table (PHI + operational)
-- ============================================
CREATE TABLE clients (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to Supabase auth (IMPORTANT!)
  user_id UUID, -- Links to Supabase auth.users.id

  -- === PHI FIELDS ===

  -- Identity
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20),

  -- Dates
  date_of_birth DATE,
  due_date DATE,

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),
  country VARCHAR(50) DEFAULT 'USA',

  -- Clinical/Health
  health_history TEXT,
  health_notes TEXT,
  allergies TEXT,
  medications TEXT,

  -- === OPERATIONAL FIELDS ===

  -- Status & Service
  status VARCHAR(50) DEFAULT 'pending',
  service_needed VARCHAR(100),

  -- Portal
  portal_status VARCHAR(50) DEFAULT 'not_invited',
  invited_at TIMESTAMP,
  last_invite_sent_at TIMESTAMP,
  invite_sent_count INTEGER DEFAULT 0,

  -- Profile
  profile_picture TEXT,
  pronouns VARCHAR(50),
  preferred_name VARCHAR(100),

  -- Service Details
  payment_method VARCHAR(50),
  home_type VARCHAR(100),
  service_specifics TEXT,
  service_support_details TEXT,
  services_interested JSONB DEFAULT '[]'::jsonb,

  -- Birth Info
  baby_name VARCHAR(100),
  baby_sex VARCHAR(20),
  number_of_babies INTEGER,
  birth_hospital VARCHAR(255),

  -- Medical Provider
  provider_type VARCHAR(100),

  -- Pregnancy Info
  pregnancy_number INTEGER,
  had_previous_pregnancies BOOLEAN,
  previous_pregnancies_count INTEGER,
  living_children_count INTEGER,
  past_pregnancy_experience TEXT,

  -- Demographics
  race_ethnicity VARCHAR(100),
  primary_language VARCHAR(50) DEFAULT 'English',
  client_age_range VARCHAR(50),

  -- Insurance & Financial
  insurance VARCHAR(100),
  annual_income VARCHAR(50),

  -- Contact Preferences
  preferred_contact_method VARCHAR(50),

  -- Other
  relationship_status VARCHAR(50),

  -- Referral
  referral_source VARCHAR(100),
  referral_name VARCHAR(100),
  referral_email VARCHAR(255),

  -- Timestamps
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_updated_at ON clients(updated_at);
CREATE INDEX idx_clients_portal_status ON clients(portal_status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Add comments
COMMENT ON TABLE clients IS 'Unified client data - all PHI and operational fields';
COMMENT ON COLUMN clients.user_id IS 'Links to Supabase auth.users.id for authentication';
COMMENT ON COLUMN clients.first_name IS 'PHI: Client first name';
COMMENT ON COLUMN clients.health_history IS 'PHI: Medical history';
COMMENT ON COLUMN clients.status IS 'Operational: Client status (pending, active, inactive)';
COMMENT ON COLUMN clients.services_interested IS 'Array of services client is interested in (e.g., ["Birth Support", "Postpartum Support"])';

-- ============================================
-- Create assignments table
-- ============================================
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  doula_id UUID, -- Links to Supabase auth.users.id
  assigned_by UUID, -- Links to Supabase auth.users.id (admin who assigned)
  status VARCHAR(50) DEFAULT 'active',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignments_client_id ON assignments(client_id);
CREATE INDEX idx_assignments_doula_id ON assignments(doula_id);
CREATE INDEX idx_assignments_status ON assignments(status);

COMMENT ON TABLE assignments IS 'Doula-client assignments';

-- ============================================
-- Create activities table
-- ============================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_by UUID, -- Links to Supabase auth.users.id
  activity_type VARCHAR(50),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_client_id ON activities(client_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);

COMMENT ON TABLE activities IS 'Client activity log and notes';

-- ============================================
-- Verification queries
-- ============================================

-- Check all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check clients table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- Verify expected tables exist
SELECT
  CASE
    WHEN COUNT(*) = 3 THEN '✅ Success! All 3 tables created (clients, assignments, activities)'
    ELSE '❌ ERROR: Expected 3 tables, found ' || COUNT(*)::text
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('clients', 'assignments', 'activities');
