# Migration Plan: Consolidate to Google Cloud SQL

## Overview
Migrate from split architecture (Supabase + Cloud SQL) to single Cloud SQL database.

---

## Step 1: Prepare Cloud SQL Database

### Add operational columns to existing `clients` table

```sql
-- Add operational fields to clients table in Cloud SQL
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS service_needed VARCHAR(100),
ADD COLUMN IF NOT EXISTS portal_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_invite_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS invite_sent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_picture TEXT,
ADD COLUMN IF NOT EXISTS pronouns VARCHAR(50),
ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS home_type VARCHAR(100);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at);

-- Add update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE
ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Step 2: Export Data from Supabase

```bash
# Export client_info table from Supabase
# Go to Supabase Dashboard → Table Editor → client_info → Export as CSV

# Or use SQL:
COPY (
  SELECT
    id,
    status,
    service_needed,
    portal_status,
    requested_at,
    updated_at,
    invited_at,
    profile_picture
  FROM client_info
) TO '/tmp/supabase_operational_data.csv' WITH CSV HEADER;
```

---

## Step 3: Import to Cloud SQL

```bash
# Upload CSV to Cloud Storage
gsutil cp /tmp/supabase_operational_data.csv gs://your-bucket/

# Import to Cloud SQL
gcloud sql import csv your-instance-name \
  gs://your-bucket/supabase_operational_data.csv \
  --database=your-database \
  --table=clients
```

---

## Step 4: Update Backend to Use Cloud SQL Only

### Replace Supabase Client with Cloud SQL

**Before (Supabase):**
```typescript
import supabase from './supabase';

const { data } = await supabase
  .from('client_info')
  .select('*')
  .eq('id', clientId);
```

**After (Cloud SQL):**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.CLOUD_SQL_HOST,
  database: process.env.CLOUD_SQL_DATABASE,
  user: process.env.CLOUD_SQL_USER,
  password: process.env.CLOUD_SQL_PASSWORD,
});

const { rows } = await pool.query(
  'SELECT * FROM clients WHERE id = $1',
  [clientId]
);
```

---

## Step 5: Update Repository Pattern

**Create unified client repository:**

```typescript
// src/repositories/cloudSqlClientRepository.ts
import { Pool } from 'pg';

export class CloudSqlClientRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.CLOUD_SQL_HOST,
      database: process.env.CLOUD_SQL_DATABASE,
      user: process.env.CLOUD_SQL_USER,
      password: process.env.CLOUD_SQL_PASSWORD,
    });
  }

  async getClientById(id: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );
    return rows[0];
  }

  async updateClient(id: string, data: Record<string, any>) {
    const fields = Object.keys(data);
    const values = Object.values(data);

    const setClause = fields
      .map((field, i) => `${field} = $${i + 2}`)
      .join(', ');

    const { rows } = await this.pool.query(
      `UPDATE clients SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }

  async getClients() {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients ORDER BY updated_at DESC'
    );
    return rows;
  }
}
```

---

## Step 6: Remove Supabase and PHI Broker

**Delete files:**
- `src/supabase.ts`
- `src/services/phiBrokerService.ts`
- `src/repositories/supabaseClientRepository.ts`

**Remove dependencies:**
```bash
npm uninstall @supabase/supabase-js
```

**Update environment variables:**
```bash
# Remove
- SUPABASE_URL
- SUPABASE_KEY
- PHI_BROKER_URL
- PHI_BROKER_SHARED_SECRET

# Keep/Add
+ CLOUD_SQL_HOST
+ CLOUD_SQL_DATABASE
+ CLOUD_SQL_USER
+ CLOUD_SQL_PASSWORD
```

---

## Step 7: Update Controllers

**Simplified controller (no split logic):**

```typescript
// src/controllers/clientController.ts
export class ClientController {
  private clientRepository: CloudSqlClientRepository;

  async updateClient(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const updateData = req.body;

    // Simple update - no split, no broker!
    const updated = await this.clientRepository.updateClient(id, updateData);

    res.json(ApiResponse.success(updated));
  }
}
```

---

## Benefits After Migration

✅ **Single source of truth** - Everything in Cloud SQL
✅ **No PHI Broker overhead** - Direct database access
✅ **No Supabase cost** - One less subscription
✅ **Simpler code** - No split logic
✅ **Full control** - Manage your own database
✅ **HIPAA compliant** - Cloud SQL supports BAA

---

## Estimated Time

- **Step 1**: 1 hour (add columns)
- **Step 2**: 30 minutes (export)
- **Step 3**: 30 minutes (import)
- **Step 4**: 3 hours (update backend)
- **Step 5**: 2 hours (repository pattern)
- **Step 6**: 1 hour (cleanup)
- **Step 7**: 2 hours (controllers)

**Total**: ~10 hours

---

## Trade-offs vs Supabase

### You Lose:
- ❌ Instant REST APIs (need to build)
- ❌ Built-in auth integration
- ❌ Realtime subscriptions
- ❌ Auto-generated SDK
- ❌ Nice dashboard UI

### You Gain:
- ✅ Full database control
- ✅ Lower cost (no Supabase)
- ✅ Single database
- ✅ Raw SQL power
- ✅ Less vendor lock-in
