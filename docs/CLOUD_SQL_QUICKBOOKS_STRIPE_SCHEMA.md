# Cloud SQL schema for QuickBooks and Stripe (post–Supabase)

**Note:** When Supabase is removed for data storage, QuickBooks and Stripe customer/sync data must live in **Google Cloud SQL**. This doc records the agreed approach.

---

## 1. QuickBooks OAuth tokens → dedicated table

- **Table:** `quickbooks_tokens` in Cloud SQL.
- **Purpose:** Store the connected company’s refresh token (and related fields) so the app can call the QuickBooks API and know “QuickBooks is connected.”
- **Implemented:** `src/utils/tokenUtils.ts` now reads and writes **Google Cloud SQL** only (getTokenFromDatabase, saveTokensToDatabase, deleteTokens). The QuickBooks connection/callback route stores tokens in Cloud SQL. Optional env: `QUICKBOOKS_ENVIRONMENT` (default `production`; set to `sandbox` when using QuickBooks Sandbox so the token row matches).

---

## Local testing (QuickBooks connection → Cloud SQL)

**Should you test locally?** Yes. That’s the right place to confirm the connect flow saves tokens to Cloud SQL.

**1. Confirm sandbox is on**

- In `.env`: `QBO_ENV=sandbox` (OAuth uses Intuit Sandbox).
- For token storage to match, also set **`QUICKBOOKS_ENVIRONMENT=sandbox`** so `tokenUtils` reads/writes the row with `environment = 'sandbox'`. If you leave it unset, it defaults to `production` and the token is stored with `environment = 'production'` (still in Cloud SQL).
- QuickBooks routes only exist when **`FEATURE_QUICKBOOKS=true`** (or `1`). Add to `.env` if needed.

**2. Prerequisites**

- Cloud SQL Proxy running on `127.0.0.1:5433`.
- Cloud SQL env set: `CLOUD_SQL_HOST=127.0.0.1`, `CLOUD_SQL_PORT=5433`, `CLOUD_SQL_DATABASE=sokana_private`, `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD`.
- QuickBooks: `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_REDIRECT_URI` (e.g. `http://localhost:5050/quickbooks/callback`).

**3. Test steps**

1. Start backend: `npm run dev`.
2. In the app (or via browser), go to the “Connect to QuickBooks” flow. That hits the auth URL route (e.g. GET `/quickbooks/auth` or `/quickbooks/auth/url`), which redirects to Intuit.
3. Sign in with your **Sandbox** QuickBooks company and authorize. You are redirected to `QB_REDIRECT_URI` (e.g. `http://localhost:5050/quickbooks/callback?...`).
4. The callback handler exchanges the code for tokens and calls `saveTokens()` → tokens are written to **Cloud SQL** `public.quickbooks_tokens`.
5. **Verify in Cloud SQL:**

   ```bash
   PGPASSWORD='YourPassword' psql -h 127.0.0.1 -p 5433 -U app_user -d sokana_private -c "SELECT id, realm_id, environment, access_token_expires_at, updated_at FROM public.quickbooks_tokens;"
   ```

   You should see one row with `realm_id` and `environment` = `sandbox` (if you set `QUICKBOOKS_ENVIRONMENT=sandbox`) or `production`.

**4. Optional: status route**

- GET `/quickbooks/status` (if implemented) may report connected and use `getTokenFromDatabase()`; that now reads from Cloud SQL.

---

## 2. Customer ↔ Stripe and QuickBooks → columns on `phi_clients`

- **No separate “customers” table required.**
- Add to **`phi_clients`** (or ensure they exist):
  - **`stripe_customer_id`** – Stripe customer ID for this client.
  - **`qbo_customer_id`** – QuickBooks customer ID for this client.
- Then `ensureStripeCustomer` and `ensureCustomerInQuickBooks` read/write Cloud SQL instead of Supabase `customers`.

---

## 3. Payment ↔ QuickBooks sync status → columns on `payments`

- **No separate “QuickBooks payment” table required.**
- Add to **`payments`**:
  - **`qbo_payment_id`** – QuickBooks payment ID after successful sync.
  - **`qb_sync_status`** – e.g. `'pending'`, `'synced'`, `'failed'`.
  - **`qb_sync_error`** – error message when sync fails (nullable).
- Then QuickBooks sync reads/updates the payment row in Cloud SQL instead of Supabase `charges`.

---

## Summary

| Data | Where in Cloud SQL |
|------|--------------------|
| QuickBooks OAuth tokens | New table: **`quickbooks_tokens`** |
| Stripe / QuickBooks customer IDs | Columns on **`phi_clients`**: `stripe_customer_id`, `qbo_customer_id` |
| QuickBooks payment sync status | Columns on **`payments`**: `qbo_payment_id`, `qb_sync_status`, `qb_sync_error` |

---

## How to run (terminal)

With Cloud SQL Proxy running (e.g. listening on `127.0.0.1:5433`), from the repo root:

```bash
PGPASSWORD='StrongPass_2026!NoSymbolsWeird' \
psql -h 127.0.0.1 -p 5433 -U app_user -d sokana_private -f migrations/cloudsql_quickbooks_stripe_columns.sql
```

Or with a heredoc (same SQL as in the file):

```bash
PGPASSWORD='StrongPass_2026!NoSymbolsWeird' \
psql -h 127.0.0.1 -p 5433 -U app_user -d sokana_private <<'SQL'
# ... paste contents of migrations/cloudsql_quickbooks_stripe_columns.sql ...
SQL
```

**Verify:**

```bash
PGPASSWORD='StrongPass_2026!NoSymbolsWeird' \
psql -h 127.0.0.1 -p 5433 -U app_user -d sokana_private -c "
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND (
    (table_name='phi_clients' AND column_name IN ('stripe_customer_id','qbo_customer_id'))
    OR (table_name='payments' AND column_name IN ('qbo_payment_id','qb_sync_status','qb_sync_error'))
    OR (table_name='quickbooks_tokens')
  )
ORDER BY table_name, ordinal_position;
"
```

**Note:** The `payments` block runs only if the `payments` table exists; if you don’t have it yet, that block is skipped (no error).

---

## quickbooks_tokens column mapping (for later code change)

The Cloud SQL table uses **`access_token_expires_at`** (and optionally `refresh_token_expires_at`). Current `tokenUtils.ts` expects **`expires_at`**. When switching QuickBooks token storage from Supabase to Cloud SQL, either:

- Add a column **`expires_at`** and keep it in sync with `access_token_expires_at`, or  
- Change `tokenUtils` to read/write **`access_token_expires_at`** and use that as the single “expires at” for the access token.
