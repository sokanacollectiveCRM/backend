Yes — then **Supabase removal becomes a production task**, not a deferred cleanup task.

But here’s the blunt truth: **you cannot just shut Supabase off today unless you prove nothing production-critical still reads/writes there.** Your own review found Supabase still present in contract persistence, request forms, and a misleading `SupabaseUserRepository` that also handles Cloud SQL hours. 

So the task is not “delete Supabase.” The task is:

> **Make production independent from Supabase, verify it, then shut Supabase down.**

## New Epic — Supabase Shutdown Before October 12

### Task S1 — Supabase dependency inventory

**Owner:** Jerry  
**Priority:** Critical  
**Goal:** Find every production dependency on Supabase.

**Acceptance criteria:**

- Search backend for all `supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `createClient`, and Supabase SDK usage.
- Search frontend for Supabase client usage.
- Classify each dependency as:
  - Auth
  - Contracts
  - Intake/request forms
  - Hours
  - Client data
  - Storage
  - Legacy/dead code
- Identify whether each path is mounted, called by frontend, used by workers, or unused.

---

### Task S2 — Confirm Supabase production data usage

**Owner:** Jerry  
**Priority:** Critical  
**Goal:** Prove whether production still needs Supabase data.

**Acceptance criteria:**

- Read-only Supabase table inventory captured.
- Row counts captured.
- Last updated/created timestamps captured where available.
- Tables mapped to current Cloud SQL equivalents.
- Any records not in Cloud SQL are flagged for migration or archival.
- No table is assumed unused just because code “looks legacy.”

---

### Task S3 — Remove Supabase from auth dependency path

**Owner:** Jerry  
**Priority:** Critical  
**Current risk:** Backend is running `AUTH_PROVIDER=dual`, so Supabase may still be part of login/session validation.

**Acceptance criteria:**

- Confirm all active users can authenticate through Identity Platform or the chosen non-Supabase path.
- Confirm session token/cookie validation does not require Supabase.
- Confirm user identity mapping exists in Cloud SQL/internal identity table.
- Change auth mode away from `dual` only after staging verification.
- Production login tested for admin, billing, doula, and client/family users.

---

### Task S4 — Remove Supabase from contract path

**Owner:** Jerry  
**Priority:** Critical  
**Current risk:** `supabaseContractService.ts` still accesses Supabase contract tables. 

**Acceptance criteria:**

- Identify whether legacy contract reads/writes still happen in production.
- Migrate required contract records into Cloud SQL/native contract tables.
- Preserve signed artifacts and signing status.
- Route both native and legacy completion through one normalized agreement-completed event.
- Disable Supabase contract reads/writes.
- Contract signing tested without Supabase.

---

### Task S5 — Remove Supabase from intake/request forms

**Owner:** Jerry  
**Priority:** High  
**Current risk:** `requestFormRepository.ts` contains both Cloud SQL and Supabase request paths. 

**Acceptance criteria:**

- Confirm active intake route.
- Confirm where new request forms are written.
- Migrate any needed Supabase request records.
- Force active intake writes to Cloud SQL.
- Test public intake flow without Supabase.
- Archive or delete Supabase adapter only after verification.

---

### Task S6 — Remove Supabase naming from hours workflow

**Owner:** Jerry  
**Priority:** Critical  
**Current risk:** `SupabaseUserRepository` reads/writes Cloud SQL hours, which makes ownership misleading. 

**Acceptance criteria:**

- Move hours methods into Care Operations repository.
- Confirm no actual Supabase table writes happen for hours.
- Preserve existing hours endpoint responses.
- Add submitted/approved/rejected lifecycle.
- Add tenant scope.
- Rename or retire misleading repository usage.

---

### Task S7 — Replace Supabase environment dependencies

**Owner:** Jerry  
**Priority:** Critical  
**Current production env includes:**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Acceptance criteria:**

- App boots in staging without Supabase env vars.
- Backend tests pass without Supabase env vars.
- Frontend build/runtime works without Supabase env vars.
- No code path crashes because Supabase env is missing.
- Remove Supabase secrets from Cloud Run only after verification.

---

### Task S8 — Migrate or archive Supabase data

**Owner:** Jerry  
**Priority:** Critical  
**Goal:** Preserve data before shutdown.

**Acceptance criteria:**

- Export Supabase schema and data backup.
- Store encrypted backup somewhere controlled.
- Migrate active records to Cloud SQL.
- Archive inactive/legacy records.
- Validate record counts.
- Validate contract/client/request references.
- Document what was migrated, archived, ignored, or deleted.

Do **not** skip the backup. Deleting cost is good. Accidentally deleting legal/payment/client history is how a cheap month becomes an expensive year.

---

### Task S9 — Prove production runs without Supabase

**Owner:** Jerry  
**Priority:** Critical  
**Goal:** Full staging verification before production shutdown.

**Acceptance criteria:**

- Deploy staging revision without Supabase env vars.
- Login works.
- Client list/read/write works.
- Provider/doula views work.
- Contract signing works.
- Intake works, if in October 12 scope.
- Hours submission works.
- Admin approval works.
- Invoice/payment flow works.
- Card update works.
- Payout record works.
- No Supabase network calls observed in logs.

---

### Task S10 — Remove Supabase from production Cloud Run

**Owner:** Jerry  
**Priority:** Critical  
**Goal:** Production no longer depends on Supabase.

**Acceptance criteria:**

- Production revision deployed without Supabase env vars.
- `AUTH_PROVIDER` no longer requires Supabase.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` removed.
- Error logs monitored after deploy.
- Rollback revision identified before deploy.
- Supabase project is not shut down until production has passed smoke tests.

---

### Task S11 — Shut down Supabase billing/project

**Owner:** Jerry/Sokana admin  
**Priority:** High  
**Goal:** Stop Supabase cost after successful production cutover.

**Acceptance criteria:**

- Final backup completed.
- Production has run without Supabase successfully.
- No active jobs/webhooks point to Supabase.
- Supabase auth users/storage/tables no longer needed.
- Billing/subscription cancelled or project paused/deleted according to Supabase options.
- Credentials revoked.

---

## Updated priority order

This is now the correct order:

1. **Inventory Supabase usage**
2. **Export/backup Supabase**
3. **Confirm auth can run without Supabase**
4. **Migrate contract/intake data if needed**
5. **Move hours into Care Operations**
6. **Remove Supabase env dependency in staging**
7. **Run full October 12 workflow without Supabase**
8. **Deploy production without Supabase env vars**
9. **Smoke test production**
10. **Then shut down Supabase billing/project**

## What not to do

Do **not**:

- Delete Supabase env vars before staging passes.
- Shut down Supabase before contract/intake/auth dependencies are verified.
- Assume `AUTH_PROVIDER=dual` means Supabase is optional.
- Assume local code review proves production behavior.
- Create new Cloud SQL tables without migrating needed Supabase records.
- Leave `SUPABASE_SERVICE_ROLE_KEY` sitting in production after cutover.

## Deadline reality

This makes October 12 tighter. Still doable, but the scope changes.

The production milestone becomes:

**Tenant-isolated care-to-billing workflow + Supabase-free runtime.**

That means you should reduce cosmetic refactor work immediately. No broad folder-moving crusade. The new priority is:

**Cut Supabase dependency, protect data, preserve login/signing/intake, then ship the billing slice.**