# Production deployment verification

Observed September 17, 2026 using authenticated, read-only Cloud Run service
and revision descriptions. Project: `sokana-private-data`; region: `us-central1`.
No deployment, configuration, database or billing mutation was performed.

## Serving services

| Field | Backend | Frontend |
| --- | --- | --- |
| Service | `sokana-private-api` | `sokana-front-end` |
| Serving revision | `sokana-private-api-00071-rkg` | `sokana-front-end-00032-h8r` |
| Traffic | 100% | 100% |
| Latest ready matches serving | Yes | Yes |
| Revision created UTC | 2026-09-10T16:59:57.222018Z | 2026-08-31T15:10:20.946061Z |
| Service URL | https://sokana-private-api-46lcr3n2qa-uc.a.run.app | https://sokana-front-end-46lcr3n2qa-uc.a.run.app |

Backend image:

```text
us-central1-docker.pkg.dev/sokana-private-data/cloud-run-source-deploy/backend/sokana-private-api@sha256:7cc56aaeff1c45f1045728de611c9edab87b3c377e973c7d5059df754a17f6b6
```

Frontend image:

```text
us-central1-docker.pkg.dev/sokana-private-data/cloud-run-source-deploy/frontend/sokana-front-end@sha256:93f2527e9deffc7d7ccf6329ba328a192a7af542e9ee071f066a671dc74dbd30
```

These image locations match the checked-in Cloud Build naming conventions.
They do not independently establish the source commit, repository, successful
test gates, build substitutions or absence of manual deployment.

## Safe backend configuration observations

| Flag | Explicit revision value |
| --- | --- |
| `AUTH_PROVIDER` | `dual` |
| `NATIVE_CONTRACTS_ENABLED` | `true` |
| `CONTRACT_OUTBOX_ENABLED` | Absent |
| `FEATURE_QUICKBOOKS` | Absent |
| `FEATURE_STRIPE` | Absent |
| `FEATURE_EMAIL` | Absent |
| `INTAKE_USE_FEATURE_PACKAGE` | Absent |
| `INTAKE_SHADOW_COMPARE` | Absent |
| `BILLING_TIME_ZONE` | Absent |

Absent means absent from the revision's explicit environment list. It is not
proof of the effective process value: image defaults, bundled configuration and
deployed source must be checked. In the reviewed local source,
`CONTRACT_OUTBOX_ENABLED` defaults to false, and `cloudrun.ts` starts the worker
only when both native signing and outbox flags are enabled. Verify how pending
post-signing events are processed before enabling or replaying anything.
The local `FEATURE_*` flags also require explicit true/1 values; a missing
QuickBooks feature flag does not prove all QuickBooks operations are disabled,
because some billing/payment-method functionality is mounted independently.

The frontend revision has no explicit container environment entries. Vite
configuration is normally compiled during build in this repository; this does
not prove its built API URL is missing. Retrieve build provenance or inspect the
served public bundle to verify API target and auth configuration.

## Backend environment inventory (names only)

```text
CLOUD_SQL_DATABASE
CLOUD_SQL_HOST
CLOUD_SQL_PORT
CLOUD_SQL_SSLMODE
CLOUD_SQL_USER
DB_INSTANCE_CONNECTION_NAME
DB_NAME
DB_USER
EMAIL_HOST
EMAIL_PORT
EMAIL_SECURE
EMAIL_USER
FRONTEND_ORIGIN
FRONTEND_URL
QB_CLIENT_ID
QB_CLIENT_SECRET
QB_REDIRECT_URI
SPLIT_DB_READ_MODE
STRIPE_SECRET_KEY
SUPABASE_ANON_KEY
SUPABASE_URL
DB_PASSWORD
CLOUD_SQL_PASSWORD
SUPABASE_SERVICE_ROLE_KEY
EMAIL_PASSWORD
AUTH_PROVIDER
IDENTITY_PLATFORM_PROJECT_ID
NATIVE_CONTRACTS_ENABLED
CONTRACT_SIGNING_BASE_URL
GCS_DOCUMENTS_BUCKET
SIGNING_RATE_LIMIT_HMAC_SECRET
```

Explicit secret-backed environment names: `DB_PASSWORD`, `CLOUD_SQL_PASSWORD`,
`SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PASSWORD`. Secret values and all other
non-allowlisted environment values were excluded from tool output and this file.
Full revision JSON was filtered in memory and was not saved.

## Remaining verification

1. Link each image digest to its build, source revision and safe build inputs.
2. Verify frontend compiled API URL and live public/domain routing.
3. Verify effective signing outbox execution and pending work without replaying it.
4. Capture schema, indexes, constraints and row counts using a read-only database connection.
5. Select the October 12 signing/payment path with business confirmation; code
   presence and environment variable names are insufficient evidence.
