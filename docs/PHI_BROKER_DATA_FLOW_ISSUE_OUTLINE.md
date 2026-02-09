# Why PHI Data Isn’t Coming Back from Cloud Run (Broker)

**Goal:** GET `/clients/:id` returns **PHI fields** (e.g. `phone_number`, `due_date`, `date_of_birth`) from the broker (Cloud Run → Cloud SQL), not just operational data.

**Current behavior:** Step 2 passes with **“PASS (partial)”**: backend returns 200 and `success: true` with `data`, but **no PHI keys** in the response. So the broker path works (no 502), but the **broker is returning empty PHI** for the test client.

---

## 1. What has to be true for data to come back

1. **Vercel** calls **Cloud Run broker** with valid HMAC (`PHI_BROKER_URL` + `PHI_BROKER_SHARED_SECRET`).
2. **Broker** accepts the request (auth passes), then queries **Cloud SQL**.
3. **Cloud SQL** has a row in **`public.phi_clients`** for that `client_id` with at least one non-null PHI column.
4. **Broker** returns `{ success: true, data: { ... PHI keys ... } }`.
5. **Vercel** merges that `data` into the client detail response.

If any of these break, you get 502 or empty PHI.

---

## 2. Most likely cause: no row or wrong schema in Cloud SQL

The broker queries **`phi_clients`** with this shape (see `phi-broker/src/repositories/phiRepository.ts`):

- **Table:** `phi_clients`
- **Filter:** `WHERE client_id = $1`
- **Columns expected:**
  - `first_name`, `last_name`, `email`
  - `phone` (selected as `phone_number`)
  - `date_of_birth`, `address_line1`, `due_date` (cast with `::text` in SQL)
  - `health_history`, `allergies`, `medications`

**Check in Cloud SQL (e.g. via Cloud Console or `gcloud sql connect`):**

| Check | What to do |
|-------|------------|
| **Row exists** | `SELECT client_id FROM phi_clients WHERE client_id = 'ced55ced-c62c-48c0-81fb-353fe4a99cc4';` If no row → no PHI. Insert a row or use a `client_id` that exists. |
| **Column names** | If your table has `phone_number` instead of `phone`, the query uses `phone AS phone_number` and will fail unless you have a column named `phone`. Fix: match the repo (use `phone` and alias in SQL) or change the repo to match the DB. |
| **Date columns** | Query uses `date_of_birth::text`, `due_date::text`. If those columns are another type, `::text` is still usually fine. If the column names differ (e.g. `dob`), the query fails or returns null. |

**Quick validation query (run in Cloud SQL):**

```sql
SELECT client_id, first_name, last_name, email, phone,
       date_of_birth::text, address_line1, due_date::text,
       health_history, allergies, medications
FROM phi_clients
WHERE client_id = 'ced55ced-c62c-48c0-81fb-353fe4a99cc4'
LIMIT 1;
```

- If this **errors** → schema/column names don’t match; fix table or repo.
- If this **returns no row** → that client has no PHI; use a `client_id` that has a row.
- If this **returns a row** with non-null values → broker should return them; next check is broker/Cloud Run.

---

## 3. Other possible causes

| Issue | Symptom | What to do |
|-------|--------|------------|
| **Broker query throws** | Cloud Run logs: `[PHI] Error processing request` | Check broker logs for the actual error (e.g. relation "phi_clients" does not exist, column "phone" does not exist). Fix schema or SQL in repo. |
| **Broker returns 200 but empty `data`** | Backend gets `{ success: true, data: {} }` | Usually no row for that `client_id` or all selected columns are null. Confirm row exists and has data. |
| **Vercel env wrong** | 502 from backend when calling broker | In Vercel, confirm `PHI_BROKER_URL` and `PHI_BROKER_SHARED_SECRET` for Production and redeploy. |
| **Wrong client_id in QA** | Script uses `ced55ced-...`; that client has no phi_clients row | Use a `client_id` that exists in **both** operational DB and `phi_clients`, or insert a row for `ced55ced-...`. |

---

## 4. Checklist to get data back from Cloud Run

1. **Cloud SQL:** Table `phi_clients` exists; has column `client_id` (UUID) and the columns above (or repo updated to match your schema).
2. **Cloud SQL:** At least one row for the client you’re testing (e.g. `ced55ced-c62c-48c0-81fb-353fe4a99cc4`) with at least one non-null PHI field.
3. **Broker (Cloud Run):** Env has `PHI_BROKER_SHARED_SECRET` and Cloud SQL connection (e.g. `SENSITIVE_DATABASE_*` or Cloud SQL connector). Broker is the revision that uses `phi_clients` (already deployed).
4. **Vercel:** `PHI_BROKER_URL` and `PHI_BROKER_SHARED_SECRET` set for Production; `SPLIT_DB_READ_MODE=primary`.
5. **Re-run QA:** Use a JWT for an admin (or doula assigned to that client). Script: `JWT_ADMIN='...' ./scripts/run-phi-qa.sh`. Step 2 should then show **PASS** with PHI keys in `data` (not just “PASS (partial)”).

---

## 5. One-line summary

**Data will come back from Google Cloud Run when:** (1) Cloud SQL has a row in `phi_clients` for that `client_id` with the columns the broker expects, and (2) the broker’s SQL matches your actual table/column names. Fix schema/row, then re-run the flow.
