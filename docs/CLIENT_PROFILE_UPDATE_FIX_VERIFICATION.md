# Client Profile Update Fix — Verification Checklist

## What was fixed

1. **Missing `city` column** — Supabase error: "Could not find the 'city' column of 'client_info' in the schema cache".
2. **Guardrails** — Unknown payload keys are now dropped so schema cache / missing column errors don’t break updates.
3. **Logging** — Removed logging of full update/response payloads (no PHI/PII in logs).

---

## 1) Endpoint and path

- **Endpoint:** `PUT /clients/:id`
- **Route:** `src/routes/clientRoutes.ts` → `clientRoutes.put('/:id', ..., clientController.updateClient)`
- **Controller:** `src/controllers/clientController.ts` → `updateClient()`
- **Use case:** `src/usecase/clientUseCase.ts` → `updateClientProfile()`
- **Repository:** `src/repositories/supabaseClientRepository.ts` → `updateClient()` → Supabase `.from('client_info').update(...)`.

---

## 2) Migration (run first)

**File:** `src/db/migrations/add_client_info_address_columns.sql`

Run in **Supabase → SQL Editor** (or your migration pipeline):

```sql
ALTER TABLE public.client_info
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT;
```

- After running, Supabase may need a short time to refresh the schema cache.
- If your project uses a migration runner, run this migration in that pipeline instead.

---

## 3) Code changes summary

| File | Change |
|------|--------|
| `src/db/migrations/add_client_info_address_columns.sql` | New migration: add address, city, state, zip_code to client_info. |
| `src/repositories/supabaseClientRepository.ts` | Added `ALLOWED_CLIENT_INFO_UPDATE_COLUMNS` whitelist; sanitize update payload before `.update()`; skip update when payload is empty after sanitization. |
| `src/controllers/clientController.ts` | Log only update keys (no values); log only response keys (no full response body). |
| `src/__tests__/clientRepositoryUpdateWhitelist.test.ts` | New test: unknown keys are dropped; known keys (e.g. city) are sent. |

---

## 4) Verification checklist

- [ ] **Run migration** in Supabase SQL Editor (or migration pipeline).
- [ ] **Wait** 1–2 minutes if needed for schema cache refresh.
- [ ] **Update client profile** from the frontend (e.g. save with city/address) or:
  ```bash
  curl -X PUT "http://localhost:5050/clients/<CLIENT_ID>" \
    -H "Content-Type: application/json" \
    -H "Cookie: sb-access-token=<JWT>" \
    -d '{"city":"NYC","first_name":"Test"}'
  ```
- [ ] **Confirm 200** response and no "Could not find the 'city' column" error.
- [ ] **Confirm in Supabase** that `client_info` row was updated (e.g. city / first_name).
- [ ] **Confirm logs** do not contain full request/response bodies (only keys/counts).
- [ ] **Run tests** (if watchman is disabled or in CI):  
  `npm test -- --testPathPattern=clientRepositoryUpdateWhitelist --watchAll=false`

---

## 5) If you don’t want a `city` column (Option 2)

If you prefer **not** to add `city` (and only allow fields that already exist):

1. Do **not** run the migration that adds address/city/state/zip_code.
2. Remove `address`, `city`, `state`, `zip_code` from `ALLOWED_CLIENT_INFO_UPDATE_COLUMNS` in `src/repositories/supabaseClientRepository.ts` (and remove the corresponding `if (fieldsToUpdate.city !== undefined)`-style mappings if you don’t want them sent at all).
3. Frontend should stop sending `city` (or map it to an existing column if you have one).

Recommendation: **Option 1 (migration)** so the UI can keep saving city/address/state/zip.
