---
name: sokana-cloudsql-local-connect
description: Connect to Sokana Cloud SQL (Postgres) locally via Cloud SQL Proxy. Use when running migrations, scripts, or backend against the sokana_private database. Never embeds credentials—password stays in shell history or a gitignored file only.
---

# Connect to Sokana Cloud SQL Locally

## Purpose

Connect to the Sokana Cloud SQL Postgres database from your machine for migrations, scripts, or running the backend. All steps are safe for sharing—no secrets in this doc.

## Non-Secret Connection Details

| Property   | Value                                                 |
| ---------- | ----------------------------------------------------- |
| Instance   | `sokana-private-data:us-central1:sokana-phi-postgres` |
| Local host | `127.0.0.1`                                           |
| Local port | `5433`                                                |
| Database   | `sokana_private`                                      |
| User       | `app_user`                                            |

---

## 1) Start Cloud SQL Proxy (Terminal A)

```bash
cloud-sql-proxy "sokana-private-data:us-central1:sokana-phi-postgres" --address 127.0.0.1 --port 5433
```

Leave this running.

---

## 2) Set Password + DATABASE_URL (Terminal B)

### Session-only (fastest, safe)

```bash
export DB_PASSWORD='PASTE_PASSWORD_HERE'
export DATABASE_URL="postgresql://app_user:${DB_PASSWORD}@127.0.0.1:5433/sokana_private?sslmode=disable"
```

Replace `PASTE_PASSWORD_HERE` with your actual password. It stays in your shell only.

### Verify connection

```bash
psql "$DATABASE_URL" -P pager=off -c "select current_database() as db, current_user as user, now();"
```

---

## 3) For Backend (CLOUD_SQL_* env vars)

If running the backend (`npm run dev`), use:

```bash
export CLOUD_SQL_HOST=127.0.0.1
export CLOUD_SQL_PORT=5433
export CLOUD_SQL_DATABASE=sokana_private
export CLOUD_SQL_USER=app_user
export CLOUD_SQL_PASSWORD='PASTE_PASSWORD_HERE'
export CLOUD_SQL_SSLMODE=disable
```

Or add these to `.env` (ensure `.env` is in `.gitignore`).

---

## 4) No-Prompt, No-Paste Every Time (gitignored file)

Store password in a local-only, gitignored file:

```bash
# One-time setup
cd /Users/jerrybony/Documents/GitHub/backend  # or your project root
printf "DB_PASSWORD=%s\n" "PASTE_PASSWORD_HERE" > .env.local
```

Add `.env.local` to `.gitignore` if not already there.

Load and use:

```bash
set -a
source .env.local
set +a
export DATABASE_URL="postgresql://app_user:${DB_PASSWORD}@127.0.0.1:5433/sokana_private?sslmode=disable"
```

---

## 5) Migration Scripts (if applicable)

From `migration-script` or similar:

```bash
cd /Users/jerrybony/Desktop/migration-script
export ARTIFACTS_DIR="./artifacts"
bash run_assignments.sh
bash run_notes_check.sh
```

Ensure `DB_PASSWORD` and `DATABASE_URL` are set in the same shell before running.

---

## 6) Retrieve Password From Terminal (if already exported)

```bash
echo "$DB_PASSWORD"
# or if you used PGPASSWORD previously:
echo "$PGPASSWORD"
```

If `DATABASE_URL` is set:

```bash
printenv DATABASE_URL
```

*(That shows the password if embedded—which is why we never put the full URL in docs.)*

---

## Troubleshooting: `invalid_grant` / `invalid_rapt`

If the proxy logs `auth: "invalid_grant" "reauth related error (invalid_rapt)"`, Application Default Credentials are expired or invalid.

**Fix:** Run in your terminal (outside automation/sandbox—browser must open):

```bash
gcloud auth application-default login
```

Complete sign-in in the browser. Then restart the proxy.

**Google Workspace:** If you use a managed Google Workspace account with strict reauth policies, `invalid_rapt` can persist. Options:
- Use a personal Google account that has Cloud project access, or
- Ask your admin to adjust reauth/RAPT requirements for dev access.

---

## Guardrails

- **Never** put the password or full `DATABASE_URL` into this skill, Notion, GitHub, or screenshots.
- Keep the password in shell history or a gitignored `.env.local` only.
- Use `PASTE_PASSWORD_HERE` (or similar) as the placeholder in shared instructions.
