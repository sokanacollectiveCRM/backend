# Cloud SQL migration – backend

Use this when client data lives in **Google Cloud SQL** and auth stays in **Supabase**.

## 1. Run the schema on Cloud SQL

Connect to your Cloud SQL instance and run:

```bash
# From repo root, connect (adjust instance and user):
# gcloud sql connect YOUR_INSTANCE --user=postgres --database=YOUR_DB

# Then run:
\i migrations/step3_create_cloudsql_schema.sql
```

Or paste the contents of `migrations/step3_create_cloudsql_schema.sql` into the Cloud SQL Studio / psql.

This creates:

- `clients` (unified PHI + operational)
- `assignments`
- `activities`

## 2. Configure backend env

In `.env` (or your deployment env), set:

```bash
# Cloud SQL (required for backend to use Cloud SQL for client data)
CLOUD_SQL_HOST=YOUR_CLOUD_SQL_IP_OR_PRIVATE_IP
CLOUD_SQL_DATABASE=postgres
CLOUD_SQL_USER=your_user
CLOUD_SQL_PASSWORD=your_password
CLOUD_SQL_PORT=5432

# Keep Supabase for auth
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Primary mode so list/detail use the repo (Cloud SQL or Supabase)
SPLIT_DB_READ_MODE=primary
```

If `CLOUD_SQL_HOST` is **not** set, the backend keeps using **Supabase** for client data (client_info, etc.).

## 3. Test authenticated access

From repo root:

```bash
# Load env (optional; or export vars manually)
set -a && source .env && set +a

# Use script (uses TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, BACKEND_URL from env)
./scripts/test-cloudsql-auth.sh
```

Or manually:

```bash
export BASE_URL=http://localhost:5050   # or your backend URL
export EMAIL=jerrybony5@gmail.com
export PASSWORD='@Bony5690'

# 1) Login (saves cookie to cookies.txt)
curl -s -c cookies.txt -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

# 2) Who am I
curl -s -b cookies.txt "$BASE_URL/auth/me"

# 3) Get clients (should return list from Cloud SQL when CLOUD_SQL_HOST is set)
curl -s -b cookies.txt "$BASE_URL/clients?limit=5"
```

## 4. Optional: seed a test client in Cloud SQL

```sql
INSERT INTO clients (id, first_name, last_name, email, status, service_needed, requested_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Test',
  'Client',
  'test@example.com',
  'pending',
  'Birth Support',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

Then run the test again; you should see this client in `GET /clients`.
