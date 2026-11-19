# Isolated Cloud Run + Cloud SQL test stack

Creates a billed, separate Cloud SQL instance and an optional Cloud Run service.
It copies **schema only** from production and fills the new database with
invented rows. It never copies client, doula, or billing data from
`sokana_private`.

Production names this tooling refuses to overwrite:

- instance `sokana-phi-postgres`
- database `sokana_private`
- Cloud Run service `sokana-private-api`

## One command

From the backend repo root, with `gcloud` already logged in:

```bash
bash scripts/dev-env/setup.sh --yes
```

That will:

1. Create `sokana-phi-postgres-dev` and database `sokana_private_dev`
2. Dump production schema only and restore it
3. Insert synthetic admins, doulas, clients, assignments, hours, and notes
4. Deploy `sokana-private-api-dev` on Cloud Run, pointed at the new database
5. Deploy `sokana-front-end-dev` for testers (no Google IAM check, same as prod frontend)

Production Cloud Run cannot use `allUsers` because of domain-restricted sharing.
Isolated services use `--no-invoker-iam-check`, matching production.

## Tester URLs

| Surface | URL |
| --- | --- |
| CRM (open this) | https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app |
| API | https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app |

The API `/` JSON `{"status":"ok"}` is expected. Testers open the CRM URL in a
browser (no Google IAM). Sign in with `hello@sokanacollective.com` (Test Admin).
If a new password was generated, it is in gitignored
`scripts/dev-env/.local/dev.env` as `DEV_ENV_ADMIN_PASSWORD`. If that key is
missing, use the existing Identity Platform password for that inbox.

Maya Tester is seeded automatically as a practice client
(`hello+pilot.client@sokanacollective.com`). Client password, when generated,
is `DEV_ENV_CLIENT_PASSWORD` in the same env file.

Pilot testers (admin, doula, client, billing hats) should follow
[`docs/PILOT_TEST_GUIDE.md`](../docs/PILOT_TEST_GUIDE.md). That guide is written
for non-technical people. The playground sends real email from
`hello@sokanacollective.com` and can charge real money through the real
QuickBooks company once someone clicks Connect on Integrations.

## Live email, QuickBooks, and payments

`deploy-cloudrun.sh` now turns `FEATURE_EMAIL`, `FEATURE_QUICKBOOKS`, and
`FEATURE_STRIPE` on for `sokana-private-api-dev`, copies SMTP/QBO/Stripe
settings from production, and binds `EMAIL_PASSWORD`. It does **not** copy
production PHI or production QuickBooks tokens.

To enable this on an already-running playground API without rebuilding:

```bash
DEV_ENV_YES=1 bash scripts/dev-env/enable-live-integrations.sh
```

Before Connect works, add this Redirect URI on the Intuit app:

`https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app/quickbooks/callback`

Connecting QuickBooks on the playground talks to the **real** company. Intuit
refresh tokens are single-use, so that Connect can disconnect the live CRM
until someone reconnects production.

Local API only (skip Cloud Run):

```bash
bash scripts/dev-env/setup.sh --yes --local-only
```

## Prerequisites

- `gcloud` authenticated for `sokana-private-data`
- `cloud-sql-proxy` (`brew install cloud-sql-proxy`)
- `pg_dump` / `psql` 18+ (`brew install postgresql@18`) or Docker with
  `postgres:18`
- Production `CLOUD_SQL_PASSWORD` in repo `.env` (used only to read schema)
- Node 20 (`npx tsx` for the seeder)

## After setup: run the API locally

```bash
cloud-sql-proxy "sokana-private-data:us-central1:sokana-phi-postgres-dev" \
  --address 127.0.0.1 --port 5434

set -a && source scripts/dev-env/.local/dev.env && set +a
npm run dev
```

Passwords live in gitignored `scripts/dev-env/.local/dev.env`. Do not commit
that file or paste it into chat.

Doula document uploads from the local API are stored under
`scripts/dev-env/.local/gcs-documents` and served through an authenticated local
API route. They do not use the shared Cloud Storage bucket or require signed
URL credentials. This setting is written to the ignored dev env file by
`create-instance.sh`; it is disabled when `NODE_ENV=production`.

## Optional Identity Platform login mapping

If you already have test auth users, put their UIDs in the env file before seed:

```bash
DEV_ENV_ADMIN_UID=identity-platform-uid-for-admin
DEV_ENV_DOULA_UID=identity-platform-uid-for-doula
```

Then re-seed:

```bash
npx tsx scripts/dev-env/seed-synthetic.ts --env-file scripts/dev-env/.local/dev.env --reset
```

Synthetic people use emails like `maya.rivera@sokana-dev.example`. They are not
real patients.

## Admin test login

`setup.sh` provisions one Identity Platform user and a matching `public.admins`
row on the isolated database. It does **not** copy production PHI and it does
**not** reset an existing Identity Platform password unless you pass
`--reset-password`.

Default email: `hello@sokanacollective.com`

The provisioner also upserts Maya Tester on `phi_clients` and removes the
legacy `hello+isolated@...` admin row from the isolated database only.

```bash
cloud-sql-proxy "sokana-private-data:us-central1:sokana-phi-postgres-dev" \
  --address 127.0.0.1 --port 5434

npx tsx scripts/dev-env/provision-admin-login.ts \
  --env-file scripts/dev-env/.local/dev.env
```

Reuse your real admin email (existing password, no reset):

```bash
npx tsx scripts/dev-env/provision-admin-login.ts \
  --env-file scripts/dev-env/.local/dev.env \
  --email you@sokanacollective.com
```

Credentials for a newly created user are written to gitignored
`scripts/dev-env/.local/dev.env` as `DEV_ENV_ADMIN_EMAIL` and
`DEV_ENV_ADMIN_PASSWORD`. Print the email only:

```bash
grep '^DEV_ENV_ADMIN_EMAIL=' scripts/dev-env/.local/dev.env
```

Then run the isolated API and the CRM against it:

```bash
set -a && source scripts/dev-env/.local/dev.env && set +a
npm run dev
```

In the frontend, set `VITE_APP_BACKEND_URL` to `http://localhost:5050` (or the
`sokana-private-api-dev` URL) and sign in with that admin email.

Identity Platform is shared with production. Linking `hello@sokanacollective.com`
to isolated Cloud SQL does **not** copy production PHI. The isolated CRM greets
this inbox as **Test Admin**. Do not pass `--reset-password` unless you intend
to rotate that Identity Platform password.

## Individual steps

```bash
bash scripts/dev-env/create-instance.sh
bash scripts/dev-env/clone-schema.sh
npx tsx scripts/dev-env/seed-synthetic.ts --env-file scripts/dev-env/.local/dev.env
bash scripts/dev-env/deploy-cloudrun.sh
```

`--yes` on `setup.sh` skips the billed-resource prompts. Instance create still
takes about 10 minutes.

## What is intentionally not copied

- Production PHI rows
- Production QuickBooks OAuth tokens (connect from the playground instead)
- Traffic or image updates to `sokana-private-api`
