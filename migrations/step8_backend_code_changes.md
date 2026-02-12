# Step 8: Backend Code Changes for Fresh Start

## Overview
Remove PHI Broker and split-database logic. All data now goes directly to Cloud SQL.

---

## Changes Required

### 1. Environment Variables (.env)

**REMOVE these:**
```bash
# No longer needed
PHI_BROKER_URL=...
PHI_BROKER_SHARED_SECRET=...
SPLIT_DB_READ_MODE=...
```

**KEEP these:**
```bash
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
```

---

### 2. Files to DELETE or DISABLE

- ❌ `src/services/phiBrokerService.ts` - no longer needed
- ❌ `src/repositories/supabaseClientRepository.ts` - all data in Cloud SQL now
- ❌ Split logic in `src/controllers/clientController.ts`
- ❌ `PUT /clients/:id/phi` endpoint (use `PUT /clients/:id` for everything)

---

### 3. Create New Cloud SQL Repository

**File: `src/repositories/cloudSqlClientRepository.ts`**

This will replace both the Supabase and PHI Broker repositories with a single, simple repository.

```typescript
import { Pool, PoolClient } from 'pg';

export interface Client {
  id: string;
  user_id?: string;

  // PHI fields
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  date_of_birth?: string;
  due_date?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  health_history?: string;
  health_notes?: string;
  allergies?: string;
  medications?: string;

  // Operational fields
  status?: string;
  service_needed?: string;
  portal_status?: string;
  invited_at?: string;
  last_invite_sent_at?: string;
  invite_sent_count?: number;
  profile_picture?: string;
  pronouns?: string;
  preferred_name?: string;
  payment_method?: string;
  home_type?: string;
  service_specifics?: string;
  service_support_details?: string;
  services_interested?: any; // JSONB

  // Birth info
  baby_name?: string;
  baby_sex?: string;
  number_of_babies?: number;
  birth_hospital?: string;

  // Provider
  provider_type?: string;

  // Pregnancy
  pregnancy_number?: number;
  had_previous_pregnancies?: boolean;
  previous_pregnancies_count?: number;
  living_children_count?: number;
  past_pregnancy_experience?: string;

  // Demographics
  race_ethnicity?: string;
  primary_language?: string;
  client_age_range?: string;

  // Insurance & Financial
  insurance?: string;
  annual_income?: string;

  // Contact
  preferred_contact_method?: string;

  // Other
  relationship_status?: string;

  // Referral
  referral_source?: string;
  referral_name?: string;
  referral_email?: string;

  // Timestamps
  requested_at?: string;
  updated_at?: string;
  created_at?: string;
}

export class CloudSqlClientRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.CLOUD_SQL_HOST,
      database: process.env.CLOUD_SQL_DATABASE,
      user: process.env.CLOUD_SQL_USER,
      password: process.env.CLOUD_SQL_PASSWORD,
      port: parseInt(process.env.CLOUD_SQL_PORT || '5432'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Get all clients
   */
  async getClients(): Promise<Client[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients ORDER BY updated_at DESC'
    );
    return rows;
  }

  /**
   * Get client by ID
   */
  async getClientById(id: string): Promise<Client | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Get client by user_id (Supabase auth.users.id)
   */
  async getClientByUserId(userId: string): Promise<Client | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  }

  /**
   * Create new client
   */
  async createClient(data: Partial<Client>): Promise<Client> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const fieldNames = fields.join(', ');

    const { rows } = await this.pool.query(
      `INSERT INTO clients (${fieldNames}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return rows[0];
  }

  /**
   * Update client (PHI + operational, all in one!)
   */
  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const setClause = fields
      .map((field, i) => `${field} = $${i + 2}`)
      .join(', ');

    const { rows } = await this.pool.query(
      `UPDATE clients SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (rows.length === 0) {
      throw new Error('Client not found');
    }

    return rows[0];
  }

  /**
   * Delete client
   */
  async deleteClient(id: string): Promise<void> {
    await this.pool.query('DELETE FROM clients WHERE id = $1', [id]);
  }

  /**
   * Get clients by status
   */
  async getClientsByStatus(status: string): Promise<Client[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM clients WHERE status = $1 ORDER BY updated_at DESC',
      [status]
    );
    return rows;
  }

  /**
   * Get clients assigned to a doula
   */
  async getClientsByDoulaId(doulaId: string): Promise<Client[]> {
    const { rows } = await this.pool.query(
      `SELECT c.* FROM clients c
       INNER JOIN assignments a ON c.id = a.client_id
       WHERE a.doula_id = $1 AND a.status = 'active'
       ORDER BY c.updated_at DESC`,
      [doulaId]
    );
    return rows;
  }

  /**
   * Close pool (for testing/cleanup)
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
```

---

### 4. Simplify Client Controller

**File: `src/controllers/clientController.ts`**

Replace complex split logic with simple updates:

**BEFORE (complex):**
```typescript
async updateClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const updateData = req.body;

  // Normalize fields
  const normalized = normalizeClientPatch(updateData);

  // Split into PHI and operational
  const { operational, phi } = splitClientPatch(normalized);

  // Write operational to Supabase
  if (Object.keys(operational).length > 0) {
    await clientRepository.updateClientOperational(id, operational);
  }

  // Write PHI to broker (slow!)
  if (Object.keys(phi).length > 0) {
    await updateClientPhi(id, requester, phi);
  }

  // Update identity cache
  // ...complex logic...
}
```

**AFTER (simple):**
```typescript
async updateClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const updateData = req.body;

  // Normalize fields
  const normalized = normalizeClientPatch(updateData);

  // Single write to Cloud SQL (fast!)
  const updated = await this.cloudSqlRepository.updateClient(id, normalized);

  res.json(ApiResponse.success(updated));
}
```

---

### 5. Remove PHI Endpoint

**File: `src/routes/clientRoutes.ts`**

**DELETE this route:**
```typescript
// PHI-specific route (no longer needed)
clientRoutes.put('/:id/phi',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientPhi(req, res)
);
```

**KEEP this route (now handles everything):**
```typescript
// Single endpoint for all updates
clientRoutes.put('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClient(req, res)
);
```

---

### 6. Update Authorization Logic

You can still keep authorization checks, but simplified:

```typescript
async canAccessClient(userId: string, role: string, clientId: string): Promise<boolean> {
  // Admins can access everything
  if (role === 'admin') {
    return true;
  }

  // Doulas can only access assigned clients
  if (role === 'doula') {
    const { rows } = await pool.query(
      `SELECT 1 FROM assignments
       WHERE client_id = $1 AND doula_id = $2 AND status = 'active'`,
      [clientId, userId]
    );
    return rows.length > 0;
  }

  return false;
}
```

---

## Testing Checklist

After making these changes:

- [ ] Environment variables updated
- [ ] PHI Broker service removed
- [ ] Cloud SQL repository created
- [ ] Controller simplified (no split logic)
- [ ] PHI endpoint removed
- [ ] Test GET /clients (should return clients from Cloud SQL)
- [ ] Test PUT /clients/:id (should update both PHI and operational fields)
- [ ] Test authorization (admin vs doula access)
- [ ] Verify no references to phiBrokerService remain
- [ ] Verify no references to supabaseClientRepository remain

---

## Benefits

✅ **Single update operation** - No more split writes
✅ **Fast updates** - No PHI Broker delay (~1 second saved per request)
✅ **Simple code** - No complex split logic
✅ **Single source of truth** - All data in Cloud SQL
✅ **Full control** - Direct database access
✅ **HIPAA compliant** - Cloud SQL supports BAA

---

## Migration Time Estimate

- Remove old services: 30 minutes
- Create Cloud SQL repository: 1 hour
- Update controllers: 1-2 hours
- Update routes: 15 minutes
- Testing: 1 hour

**Total: ~4 hours**
