# Fresh Start: Clean Database Setup

## Overview
Start from scratch with a clean, consolidated architecture:
- **Supabase**: Auth only
- **Cloud SQL**: All client data (PHI + operational)

---

## Step 1: Backup Current Data (CRITICAL!)

```bash
chmod +x scripts/backup-before-reset.sh
./scripts/backup-before-reset.sh
```

**Export from Supabase Dashboard:**
1. Go to Table Editor
2. Export `client_info`, `assignments`, `activities` as CSV
3. Save to `backups/` folder

**Export from Cloud SQL:**
1. Export your PHI data
2. Save to `backups/` folder

---

## Step 2: Clean Supabase

Keep only auth tables, remove all client data tables:

```sql
-- In Supabase SQL Editor:

-- Drop client data tables (keep auth.users!)
DROP TABLE IF EXISTS client_info CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS client_activities CASCADE;

-- Verify only auth tables remain:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Should return empty or minimal tables
```

---

## Step 3: Set Up Fresh Cloud SQL Schema

### Create unified `clients` table with ALL fields

```sql
-- In Cloud SQL:

-- Drop existing tables
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS activities CASCADE;

-- Create fresh clients table (PHI + operational)
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
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE clients IS 'Unified client data - all PHI and operational fields';
COMMENT ON COLUMN clients.user_id IS 'Links to Supabase auth.users.id for authentication';
COMMENT ON COLUMN clients.first_name IS 'PHI: Client first name';
COMMENT ON COLUMN clients.health_history IS 'PHI: Medical history';
COMMENT ON COLUMN clients.status IS 'Operational: Client status (pending, active, inactive)';
```

---

## Step 4: Create Assignments Table

```sql
-- Doula assignments
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
```

---

## Step 5: Create Activities Table

```sql
-- Client activities/notes
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
```

---

## Step 6: Verify Schema

```sql
-- Check all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check clients table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- Should show ALL columns (PHI + operational)
```

---

## Step 7: Update Backend Configuration

### Environment Variables

```bash
# .env
# Supabase (auth only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Cloud SQL (all client data)
CLOUD_SQL_HOST=your-cloud-sql-ip
CLOUD_SQL_DATABASE=your-database-name
CLOUD_SQL_USER=your-user
CLOUD_SQL_PASSWORD=your-password
CLOUD_SQL_PORT=5432

# Remove these (no longer needed):
# PHI_BROKER_URL
# PHI_BROKER_SHARED_SECRET
# SPLIT_DB_READ_MODE
```

---

## Step 8: Backend Code Changes

### Remove/Disable:
- ❌ `src/services/phiBrokerService.ts`
- ❌ `src/repositories/supabaseClientRepository.ts`
- ❌ Split logic in controllers
- ❌ `PUT /clients/:id/phi` endpoint (use PUT /clients/:id)

### Keep:
- ✅ Supabase auth middleware
- ✅ JWT verification

### Add:
- ✅ Cloud SQL repository
- ✅ Unified update logic (no split)

---

## Step 9: Test Fresh Setup

```bash
# 1. Create a test user in Supabase Auth
# Dashboard → Authentication → Add user

# 2. Create a test client in Cloud SQL
INSERT INTO clients (
  user_id,
  first_name,
  last_name,
  email,
  status
) VALUES (
  'user-id-from-supabase',
  'Test',
  'User',
  'test@example.com',
  'active'
);

# 3. Test API
curl -X GET "http://localhost:5050/clients" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

---

## Benefits of Fresh Start

✅ **Clean slate** - No legacy data or schema issues
✅ **Proper structure** - All fields in right place from start
✅ **No missing columns** - Everything defined upfront
✅ **Simple architecture** - Auth in Supabase, data in Cloud SQL
✅ **Fast** - No PHI Broker overhead
✅ **Maintainable** - Clear separation of concerns

---

## Rollback Plan

If something goes wrong:
1. Your backups are in `backups/YYYYMMDD_HHMMSS/`
2. Re-import CSV files to respective databases
3. Restore original code from git

---

## Next Steps After Setup

1. ✅ Verify schema is correct
2. ✅ Test auth flow (Supabase)
3. ✅ Test client CRUD (Cloud SQL)
4. ✅ Update frontend to use new structure
5. ✅ Migrate production data (when ready)

---

**Ready to start fresh? Follow these steps in order!** 🚀
