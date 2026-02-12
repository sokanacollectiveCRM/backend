# Migration Plan: Consolidate to One Database (Supabase)

## Overview
Migrate from split architecture (Supabase + Cloud SQL) to single Supabase database.

---

## Step 1: Add Missing PHI Columns to Supabase

```sql
-- Add PHI columns to client_info table in Supabase
ALTER TABLE client_info
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS health_history TEXT,
ADD COLUMN IF NOT EXISTS health_notes TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS medications TEXT;

-- Add comments
COMMENT ON COLUMN client_info.first_name IS 'PHI: Client first name';
COMMENT ON COLUMN client_info.health_history IS 'PHI: Medical history';
-- ... etc
```

---

## Step 2: Migrate Existing PHI Data

```sql
-- Export from Cloud SQL (phi-broker database)
-- Import to Supabase client_info table

-- Example migration query (run in Cloud SQL first)
SELECT
  client_id,
  first_name,
  last_name,
  email,
  phone_number,
  date_of_birth,
  due_date,
  address_line1,
  city,
  state,
  zip_code,
  health_history,
  allergies,
  medications
FROM phi_data;

-- Then import the CSV to Supabase client_info
```

---

## Step 3: Update Backend Code

### Remove PHI Broker Service

**Delete/disable:**
- `src/services/phiBrokerService.ts` (no longer needed)
- PHI Broker environment variables

### Simplify Client Controller

**Before (split):**
```typescript
// Split operational and PHI fields
const { operational, phi } = splitClientPatch(normalized);

// Write operational to Supabase
await clientRepository.updateClientOperational(id, operational);

// Write PHI to broker (slow!)
await updateClientPhi(id, requester, phi);
```

**After (consolidated):**
```typescript
// Write everything to Supabase (fast!)
await clientRepository.updateClient(id, normalized);
```

### Remove PUT /clients/:id/phi Endpoint

**No longer needed** - use `PUT /clients/:id` for everything

---

## Step 4: Enable Row-Level Security (RLS)

Protect PHI in Supabase with RLS policies:

```sql
-- Enable RLS on client_info
ALTER TABLE client_info ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see everything
CREATE POLICY "Admins can view all clients"
ON client_info FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = id
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Policy: Doulas can only see assigned clients
CREATE POLICY "Doulas can view assigned clients"
ON client_info FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.client_id = client_info.id
    AND assignments.doula_id = auth.uid()
    AND assignments.status = 'active'
  )
);

-- Policy: Admins and assigned doulas can update
CREATE POLICY "Admins and assigned doulas can update"
ON client_info FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = id
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR EXISTS (
        SELECT 1 FROM assignments
        WHERE assignments.client_id = client_info.id
        AND assignments.doula_id = auth.uid()
        AND assignments.status = 'active'
      )
    )
  )
);
```

---

## Step 5: Update Frontend

**Before:**
```typescript
// Had to use special PHI endpoint
await updateClientPhi(clientId, { firstName: 'Jane' });
```

**After:**
```typescript
// Use single endpoint for everything (simpler!)
await updateClient(clientId, {
  firstName: 'Jane',
  status: 'active',
  serviceNeeded: 'Doula'
});
```

---

## Benefits After Migration

✅ **No more split-write logic**
✅ **No more PHI Broker delays** (~1 second per update)
✅ **No more missing column errors**
✅ **Simpler debugging**
✅ **Faster UI updates**
✅ **Single source of truth**
✅ **Still HIPAA compliant** (with RLS + encryption)

---

## Rollback Plan

If needed, you can always re-enable the PHI Broker later by:
1. Keeping PHI columns in Supabase (no data loss)
2. Re-enabling phiBrokerService.ts
3. Syncing data back to Cloud SQL

---

## Estimated Time

- **Step 1**: 30 minutes (add columns)
- **Step 2**: 1 hour (migrate data)
- **Step 3**: 2 hours (update backend code)
- **Step 4**: 1 hour (enable RLS)
- **Step 5**: 30 minutes (update frontend)

**Total**: ~5 hours

---

## Questions?

1. Do you have existing PHI data in Cloud SQL that needs migration?
2. Do you need help with the actual migration scripts?
3. Should we proceed with consolidation?
