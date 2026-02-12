# Cloud SQL local dev and E2E test

Backend reads/writes client data from **Google Cloud SQL** (database: `sokana_private`). Supabase is **auth only**. This doc covers local connection and testing.

## Env vars (required for backend)

```bash
# Cloud SQL (required — backend fails fast on boot if missing)
CLOUD_SQL_HOST=127.0.0.1
CLOUD_SQL_PORT=5433
CLOUD_SQL_DATABASE=sokana_private
CLOUD_SQL_USER=app_user
# In .env use as-is; in shell use single quotes: CLOUD_SQL_PASSWORD='StrongPass_2026!NoSymbolsWeird'
CLOUD_SQL_PASSWORD=StrongPass_2026!NoSymbolsWeird
CLOUD_SQL_SSLMODE=disable

# Supabase (auth only)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>
SUPABASE_ANON_KEY=<key>
```

Optional: `CLOUD_SQL_SSLMODE=require` (or `verify-full`) for production.

## 1) Start Cloud SQL Proxy

Use the correct connection name for your instance (e.g. `sokana-private-data:us-central1:sokana-phi-postgres`) and bind to `127.0.0.1:5433`:

```bash
cloud-sql-proxy --port 5433 sokana-private-data:us-central1:sokana-phi-postgres
```

Or with TCP:

```bash
cloud-sql-proxy --address 127.0.0.1 --port 5433 sokana-private-data:us-central1:sokana-phi-postgres
```

Leave this running in a terminal.

## 2) Export env and start backend

In another terminal, from the backend repo root. **Use single quotes around the password** so zsh doesn’t treat `!` as history expansion:

```bash
export CLOUD_SQL_HOST=127.0.0.1
export CLOUD_SQL_PORT=5433
export CLOUD_SQL_DATABASE=sokana_private
export CLOUD_SQL_USER=app_user
export CLOUD_SQL_PASSWORD='StrongPass_2026!NoSymbolsWeird'
export CLOUD_SQL_SSLMODE=disable

npm run dev
```

Alternatively, put these in `.env` (no need to quote there) and run `npm run dev`; the app loads `.env` via dotenv.

Backend will fail on startup if any required Cloud SQL env var is missing.

## 3) (One-time) Add backend columns to phi_clients

If `phi_clients` was created without the backend columns, run the migration (with Cloud SQL Proxy running):

```bash
psql "host=127.0.0.1 port=5433 dbname=sokana_private user=app_user password=YOUR_PASSWORD" -f migrations/alter_phi_clients_backend_columns.sql
```

Use single quotes around the password in the shell if it contains `!`. Or set `PGPASSWORD='...'` and omit `password=` from the connection string.

## 4) Run E2E test (login + GET /clients)

Using the script that logs in and then calls GET /clients (cookie or Bearer):

```bash
TEST_ADMIN_EMAIL=jerrybony5@gmail.com TEST_ADMIN_PASSWORD=Bony5690 npx tsx scripts/fetch-cloudsql-data.ts
```

- **Expected:** HTTP 200 and JSON with `{ success: true, data: [...], meta: { count: N } }` (client list from Cloud SQL). No 503.
- **If 503:** Cloud SQL env vars are not set or proxy is not running.

## 5) Optional: Bearer token

Login response includes `token`. You can call protected routes with:

```bash
TOKEN=$(curl -s -X POST http://localhost:5050/auth/login -H "Content-Type: application/json" -d '{"email":"jerrybony5@gmail.com","password":"Bony5690"}' | jq -r '.token')
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:5050/clients?limit=5"
```

## 6) Health check

Public endpoint (no auth):

```bash
curl -s http://localhost:5050/health
```

Expected: `{"status":"ok","service":"sokana-private-api","timestamp":"..."}`

## 7) Cloud SQL read/write test (no real data)

Verifies that the **test user** (app DB user) can read and write to Cloud SQL using a dedicated test table only (no `phi_clients`, `payments`, or other real data):

```bash
export CLOUD_SQL_HOST=127.0.0.1 CLOUD_SQL_PORT=5433 CLOUD_SQL_DATABASE=sokana_private CLOUD_SQL_USER=app_user CLOUD_SQL_PASSWORD='YourPassword' CLOUD_SQL_SSLMODE=disable
npx tsx scripts/test-cloudsql-read-write.ts
```

The script creates `cloudsql_connectivity_test` if missing, inserts one row, selects it back, deletes it, and exits with **PASS** or **FAIL**. Use this to confirm read and write work before relying on the app.

---

## Login troubleshooting

**Routes:** The backend accepts **POST /auth/login** and **POST /login** (alias). The frontend must call one of these; **POST /login** alone (without the `/auth` prefix) is supported so both base paths work.

**GET /auth/me and "No token found":** After a successful login the backend sets a cookie `sb-access-token` and returns `token` in the JSON. For **GET /auth/me** the backend looks for the token in: **X-Session-Token** header, **Authorization: Bearer &lt;token&gt;** header, or **cookie** `sb-access-token`. The frontend must send one of these (e.g. `credentials: 'include'` for cookies, or `Authorization: Bearer &lt;token&gt;`).

### "Invalid login credentials"

Login is validated **only by Supabase Auth** (`auth.users`). The backend does not check a Cloud SQL users table for passwords.

1. **Same Supabase project**  
   Ensure `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the **same** Supabase project where the user was created. If the backend points at a different project (or anon key from another project), sign-in will fail.

2. **User exists and is allowed to sign in**  
   In Supabase Dashboard → Authentication → Users, confirm the user exists and is not disabled. If "Confirm email" is enabled, the user must have confirmed their email (or you confirm them in the dashboard).

3. **Reset password to a known value**  
   From the backend repo (with the same Supabase env loaded):
   ```bash
   ADMIN_EMAIL=jerrybony5@gmail.com ADMIN_NEW_PASSWORD=Bony5690 npx tsx scripts/set-admin-password.ts
   ```
   Then log in with that exact email and password (no extra spaces).

4. **Backend logs**  
   On failed login the backend logs a line like:
   ```text
   [auth] Login failed { email: '...', reason: 'Invalid login credentials' }
   ```
   Use it to confirm which email is being checked and the exact Supabase error (e.g. "Email not confirmed").
