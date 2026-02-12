# Fresh Start Execution Checklist

## ⚠️ CRITICAL: This will delete all client data!

Make sure you have backups before proceeding.

---

## Pre-Execution (Safety First)

- [ ] **Review the plan** - Read [FRESH_START.md](./FRESH_START.md)
- [ ] **Verify backups location** - Check `backups/` folder exists
- [ ] **Confirm databases** - You have access to both Supabase and Cloud SQL
- [ ] **Note current branch** - Currently on `phi-compliance-refactor`
- [ ] **Commit current work** - `git status` shows clean

---

## Phase 1: Backup & Verification (30 min)

### 1.1 Run verification script
```bash
chmod +x scripts/verify-current-state.sh
./scripts/verify-current-state.sh
```
- [ ] Supabase URL is set
- [ ] Cloud SQL host is set
- [ ] Reviewed what will be deleted

### 1.2 Create backups
```bash
chmod +x scripts/backup-before-reset.sh
./scripts/backup-before-reset.sh
```
- [ ] Backup completed successfully
- [ ] Backup folder created with timestamp
- [ ] CSV exports downloaded from Supabase dashboard
  - [ ] client_info table exported
  - [ ] assignments table exported
  - [ ] activities table exported

---

## Phase 2: Clean Databases (15 min)

### 2.1 Clean Supabase
```sql
-- Run in Supabase SQL Editor
-- File: migrations/step2_clean_supabase.sql
```
- [ ] Opened Supabase SQL Editor
- [ ] Executed `DROP TABLE` commands
- [ ] Verified only auth tables remain
- [ ] Status shows "✅ Clean! No client data tables in public schema"

### 2.2 Verify Supabase is clean
```sql
-- Should only show auth.* tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
- [ ] public schema is empty (or only has non-client tables)
- [ ] auth schema still has users, sessions, etc.

---

## Phase 3: Create Fresh Cloud SQL Schema (30 min)

### 3.1 Execute Cloud SQL setup
```sql
-- Run in Cloud SQL
-- File: migrations/step3_create_cloudsql_schema.sql
```
- [ ] Connected to Cloud SQL
- [ ] Executed DROP TABLE commands
- [ ] Executed CREATE TABLE clients
- [ ] Executed CREATE TABLE assignments
- [ ] Executed CREATE TABLE activities
- [ ] All indexes created
- [ ] Trigger created (update_updated_at)
- [ ] Verification shows 3 tables created

### 3.2 Verify Cloud SQL schema
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
- [ ] `activities` table exists
- [ ] `assignments` table exists
- [ ] `clients` table exists

```sql
-- Check clients has all columns (should show ~50 columns)
SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'clients';
```
- [ ] clients table has all columns (PHI + operational)
- [ ] `services_interested` is JSONB type
- [ ] `user_id` column exists (links to Supabase auth)

---

## Phase 4: Update Backend Code (3-4 hours)

### 4.1 Update environment variables
```bash
# Edit .env file
```
- [ ] Removed `PHI_BROKER_URL`
- [ ] Removed `PHI_BROKER_SHARED_SECRET`
- [ ] Removed `SPLIT_DB_READ_MODE`
- [ ] Kept `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- [ ] Kept `CLOUD_SQL_*` variables

### 4.2 Create Cloud SQL repository
```bash
# Create new file: src/repositories/cloudSqlClientRepository.ts
# Use code from: migrations/step8_backend_code_changes.md
```
- [ ] Created `CloudSqlClientRepository` class
- [ ] Implemented `getClients()`
- [ ] Implemented `getClientById()`
- [ ] Implemented `createClient()`
- [ ] Implemented `updateClient()` (single write, no split!)
- [ ] Implemented `deleteClient()`
- [ ] Implemented authorization helpers

### 4.3 Update client controller
```typescript
// File: src/controllers/clientController.ts
```
- [ ] Removed `updateClientPhi()` method
- [ ] Simplified `updateClient()` to use single Cloud SQL write
- [ ] Removed PHI Broker imports
- [ ] Removed split logic (`splitClientPatch`)
- [ ] Updated to use `CloudSqlClientRepository`

### 4.4 Update routes
```typescript
// File: src/routes/clientRoutes.ts
```
- [ ] Removed `PUT /clients/:id/phi` route
- [ ] Kept `PUT /clients/:id` route (handles everything now)
- [ ] Verified all routes use new repository

### 4.5 Remove old services
- [ ] Deleted or commented out `src/services/phiBrokerService.ts`
- [ ] Deleted or commented out `src/repositories/supabaseClientRepository.ts`
- [ ] Searched codebase for `phiBroker` references (should find none)
- [ ] Searched codebase for `supabaseClientRepository` references (should find none)

### 4.6 Update dependencies (optional)
```bash
# If you want to remove Supabase client library
npm uninstall @supabase/supabase-js

# Keep @supabase/supabase-js ONLY if you're using it for auth
# (you likely are, so skip this step)
```
- [ ] Decided whether to keep Supabase client library
- [ ] Dependencies updated if needed

---

## Phase 5: Testing (1-2 hours)

### 5.1 Start backend
```bash
npm run dev
```
- [ ] Backend starts without errors
- [ ] No PHI Broker connection errors
- [ ] Cloud SQL connection successful

### 5.2 Test client endpoints

#### GET /clients
```bash
curl -X GET "http://localhost:5050/clients" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```
- [ ] Returns empty array (expected - fresh database)
- [ ] No errors in logs

#### POST /clients (create test client)
```bash
curl -X POST "http://localhost:5050/clients" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "status": "pending",
    "serviceNeeded": "Birth Support"
  }'
```
- [ ] Client created successfully
- [ ] Response includes both PHI and operational fields
- [ ] Data appears in Cloud SQL clients table

#### PUT /clients/:id (update everything)
```bash
curl -X PUT "http://localhost:5050/clients/CLIENT_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated",
    "status": "active",
    "healthHistory": "Test health info",
    "serviceSpecifics": "Test service details"
  }'
```
- [ ] Update succeeds
- [ ] Both PHI and operational fields updated
- [ ] Single database write (check logs)
- [ ] No PHI Broker calls
- [ ] Response is fast (< 500ms)

#### GET /clients/:id
```bash
curl -X GET "http://localhost:5050/clients/CLIENT_ID" \
  -H "Authorization: Bearer YOUR_JWT"
```
- [ ] Returns updated client with all fields
- [ ] PHI fields present (firstName, healthHistory)
- [ ] Operational fields present (status, serviceSpecifics)

### 5.3 Test authorization
```bash
# As doula (should fail - not assigned)
curl -X GET "http://localhost:5050/clients/CLIENT_ID" \
  -H "Authorization: Bearer YOUR_DOULA_JWT"
```
- [ ] Returns 403 Forbidden (doula not assigned)

```bash
# Create assignment, then retry
# Should succeed after assignment
```
- [ ] After assignment, doula can access client

### 5.4 Verify old endpoint is gone
```bash
# This should return 404
curl -X PUT "http://localhost:5050/clients/CLIENT_ID/phi" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Test"}'
```
- [ ] Returns 404 Not Found (endpoint removed)

---

## Phase 6: Frontend Updates (1-2 hours)

### 6.1 Update API calls
- [ ] Remove calls to `PUT /clients/:id/phi`
- [ ] Use `PUT /clients/:id` for all updates
- [ ] Update TypeScript types to include all fields in one interface
- [ ] Remove split logic from frontend

### 6.2 Test frontend
- [ ] Login works (Supabase auth)
- [ ] Client list loads
- [ ] Client profile loads
- [ ] Profile updates work (both PHI and operational)
- [ ] No infinite loops
- [ ] No 500 errors
- [ ] Updates are fast

---

## Phase 7: Production Deployment (when ready)

### 7.1 Pre-deployment
- [ ] All tests pass
- [ ] Verified in staging environment
- [ ] Backup production databases
- [ ] Schedule maintenance window
- [ ] Notify users of downtime

### 7.2 Deploy
- [ ] Run migrations on production Cloud SQL
- [ ] Clean production Supabase (keep auth!)
- [ ] Deploy new backend code
- [ ] Deploy new frontend code
- [ ] Smoke test production

### 7.3 Post-deployment
- [ ] Verify auth works
- [ ] Verify client CRUD works
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Notify users system is back up

---

## Rollback Plan (if something goes wrong)

If you need to rollback:

1. **Restore databases**
   ```bash
   # Restore from backups/ folder
   # Re-import CSV files to Supabase
   ```

2. **Restore code**
   ```bash
   git checkout phi-compliance-refactor
   git reset --hard COMMIT_HASH_BEFORE_CHANGES
   ```

3. **Restart services**
   ```bash
   npm run dev
   ```

---

## Success Criteria

You know it's working when:

- ✅ Backend starts without errors
- ✅ GET /clients returns data from Cloud SQL
- ✅ PUT /clients/:id updates both PHI and operational fields in one call
- ✅ Updates are fast (< 500ms, no PHI Broker delay)
- ✅ Authorization works (admin and assigned doula)
- ✅ No references to PHI Broker in code
- ✅ Frontend can update profiles without errors
- ✅ All data lives in Cloud SQL, auth in Supabase

---

## Time Estimates

- **Phase 1** (Backup): 30 minutes
- **Phase 2** (Clean): 15 minutes
- **Phase 3** (Schema): 30 minutes
- **Phase 4** (Code): 3-4 hours
- **Phase 5** (Testing): 1-2 hours
- **Phase 6** (Frontend): 1-2 hours

**Total: 6-9 hours**

---

## Questions Before Starting?

1. Do you have admin access to both Supabase and Cloud SQL?
2. Do you have a backup of production data (if this is production)?
3. Are you ready to delete all client data and start fresh?
4. Do you want to proceed step-by-step with guidance?

---

**Ready to start? Begin with Phase 1!** 🚀
