# Security P0 hardening summary

**Status:** complete (2026-08-14)  
**Epic:** `.cursor/handoffs/open/2026-08-10-backend-architecture-boundary-refactor.md`  
**Baseline
after work:** 46 Jest suites / 374 tests + `npm run test:security-smoke` in CI
and Cloud Build

This document records what was shipped for pilot security (backend + frontend
P0), Cloud SQL / Cloud Run encryption at rest and in transit, what is
intentionally deferred, and how that work feeds a HIPAA program next — without
claiming the system is HIPAA-compliant.

---

## Goal

Protect the pilot without a rewrite: close obvious exposures, harden
auth/webhooks/public intake, keep API contracts stable, and make tests a deploy
gate.

---

## What was done

### PR 3 — Immediate containment

- Removed localhost debug telemetry (`127.0.0.1:7707`) from client assignment
  paths.
- Redacted sensitive logs (tokens, SignNow field dumps, email password previews,
  PHI-adjacent payloads).
- Stopped returning stacks and raw provider payloads on unexpected 500s.
- Removed hardcoded SignNow API token from legacy service paths.

### PR 4 — Endpoint authorization

- Published live matrix:
  [`ENDPOINT_AUTHORIZATION_MATRIX.md`](./ENDPOINT_AUTHORIZATION_MATRIX.md).
- Protected previously anonymous payment, contract, signing, template,
  invitation, and debug/maintenance routes.
- Shared policies in `src/security/authorizationPolicies.ts` + matrix tests.

### PR 5 — Webhooks and OAuth

- SignNow + QuickBooks webhook HMAC verification.
- Replay/idempotency via webhook event ledger.
- Webhooks mounted outside user-session auth (provider auth retained).
- QB OAuth state: cryptographically random, stored, expiring, single-use.

### PR 6 — Authentication

- Authoritative roles from Cloud SQL / app-managed sources — **never** grant
  staff from Supabase `user_metadata`.
- Canonical session cookie `sb-access-token`; dual-support for legacy transports
  with telemetry.
- Transport priority documented in the auth matrix companion notes.

### PR 7 — HTTP contracts (security-adjacent)

- Canonical error codes / envelope helpers.
- Zod validation on migrated routes (including login).
- Deprecation headers/telemetry on legacy aliases (aliases not removed yet).

### PR 8 + intake abuse — Public request submission

- Feature package behind existing façade: `src/features/intake/`.
- Public `POST /requestService/requestSubmission` abuse protection:
  - honeypot fields → silent fake success
  - IP + email rate limits → `429` + `RATE_LIMITED` + `Retry-After`
  - optional `Idempotency-Key` replay
  - soft email fingerprint dedupe (covers double-submit without FE changes)
- Migration applied on Cloud SQL (`sokana_private`):
  - `public.intake_rate_limits`
  - `public.intake_idempotency_keys`

### Frontend P0 (aligned with this backend — 2026-08-14)

The SPA is **hardened for the P0 issues we targeted**. It is not “fully secure”
— a SPA never is. The API still has to enforce everything.

**In place (frontend-crm on Cloud Run `sokana-front-end`):**

- Staff vs client comes from `GET /auth/me`, not Supabase `user_metadata`.
- `StaffCrmRoute` / `ClientPortalRoute` keep clients out of the CRM and staff
  out of the portal.
- CRM calls go through `fetchWithAuth` (cookie + `Authorization` /
  `X-Session-Token` from sessionStorage). No global `window.fetch` patch.
- Public intake: honeypot fields `website` / `company_url` / `fax_number` /
  `hp_field` (backend fake-200), `Idempotency-Key`, `429`/`RATE_LIMITED` +
  `Retry-After`, `credentials: 'omit'`. Test-data fill is off unless Vite `DEV`
  or `VITE_ENABLE_REQUEST_TEST_DATA=true`.
- `skip_email_notifications` is not sent. Contract verification is not stored in
  localStorage.
- `403` is forbidden, not logout.

**What that does not mean:**

- The UI is not the security boundary. Anyone can call the API; this backend
  must reject unauthorized requests (matrix + role resolver + intake abuse
  remain the source of truth).
- Production login on iOS can still fail if cookies are third-party and the
  login JSON `token` is not stored and sent as a header. That is auth
  reliability, not skipped hardening.
- A token in `sessionStorage` is usable if XSS exists. Put CSP /
  `frame-ancestors` / HSTS on the **Cloud Run frontend container** (or load
  balancer). `vercel.json` does not protect production; Vercel is being
  decommissioned.
- Cloud Build bakes the API host via `_VITE_APP_BACKEND_URL`
  (`VITE_APP_BACKEND_URL` / `VITE_API_BASE_URL`). Optional cutover:
  `VITE_USE_CLOUD_RUN` + `VITE_CLOUD_RUN_API_URL`.

**P2 leftovers (not P0):** `AuthCallback` still posts `{ access_token }`
(backend still accepts with `legacy.body_access_token` telemetry). Portal
sessions still persist in Supabase `localStorage` (`sb-auth`). Mobile layout is
UX, not a security hole.

**Bottom line:** frontend P0 is done and aligned with this backend. Treat it as
that — not as a finished security program.

### Quality gates

- Jest open-handle flake addressed.
- GitHub Actions + Cloud Build require `npm test` and `test:security-smoke`
  before deploy.
- Inventories / journeys:
  - [`ROUTE_RESPONSE_CONTRACT_INVENTORY.md`](./ROUTE_RESPONSE_CONTRACT_INVENTORY.md)
  - [`PILOT_JOURNEYS_AND_ROLLBACK.md`](./PILOT_JOURNEYS_AND_ROLLBACK.md)

---

## What is still dual-supported (not retired yet)

These are **compatibility**, not unfinished P0 blockers:

| Item                                          | Current state           | Next step                                 |
| --------------------------------------------- | ----------------------- | ----------------------------------------- |
| JSON/query/body access tokens                 | Accepted with telemetry | Retire after FE proves cookie/header-only |
| Legacy `session` cookie                       | Accepted temporarily    | Drop after `sb-access-token` only         |
| Route aliases (`/client` vs `/clients`, etc.) | Deprecation headers     | Remove after telemetry quiet (P2)         |
| Zod / canonical errors                        | Incremental             | Expand per migrated route                 |

---

## Recommended next security follow-through (not P0)

1. **Measure then retire** legacy auth transports.
2. **QB sync ownership + outbox** before FE stops driving sync (idempotent
   money-adjacent writes).
3. **Correlation IDs + safe audit events**.
4. **Clarify deferred matrix notes** (e.g. `GET /api/payments` role nuance;
   unmounted DocuSign/Stripe files).
5. **Shrink aliases** only after deprecation signal is clean.

Do **not** treat folder refactors as security work.

---

## Encryption at rest and in transit (done)

Verified on `sokana-phi-postgres` / Cloud Run `sokana-private-api` (2026-08-14).
This is **Google-managed encryption**, not CMEK and not app-level field
encryption.

### At rest

| Layer                                | What is in place                                   | What it means                                                                                                                     |
| ------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cloud SQL disks                      | Google-managed encryption (no `kmsKeyName` / CMEK) | Data on `sokana-phi-postgres` is encrypted on disk. Google holds the keys. Default for Cloud SQL; empty CMEK fields are expected. |
| Automated backups                    | On; 7-day retention                                | Backup files are stored encrypted at rest (Google-managed).                                                                       |
| Point-in-time recovery               | On; 7-day transaction logs in Cloud Storage        | WAL/transaction logs are also encrypted at rest in GCS.                                                                           |
| Cloud Run / Artifact Registry images | Google-managed                                     | Container images and Cloud Run ephemeral disks use GCP defaults.                                                                  |

We did **not** turn on customer-managed keys (CMEK) or encrypt individual PHI
columns in the app. Those are later, compliance-driven choices — not P0.

### In transit

| Hop                       | What is in place                                                                                           | What it means                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser / SPA → Cloud Run | HTTPS (Google-managed certs on `*.run.app`)                                                                | Clients talk TLS to `sokana-private-api` and `sokana-front-end`.                                                                                                      |
| Cloud Run → Cloud SQL     | Cloud SQL Connector unix socket (`run.googleapis.com/cloudsql-instances` + `CLOUD_SQL_HOST=/cloudsql/...`) | The connector encrypts the path from Cloud Run to the instance. `CLOUD_SQL_SSLMODE=disable` on that socket is **correct** — TLS is not negotiated on the unix socket. |
| Any IP client → Cloud SQL | `sslMode: ENCRYPTED_ONLY`                                                                                  | Connections over the instance IP must use encrypted Postgres (TLS). `requireSsl: false` is the older flag; `sslMode` is what matters.                                 |
| Laptop → Cloud SQL (dev)  | Cloud SQL Auth Proxy `127.0.0.1:5433`; app uses `CLOUD_SQL_SSLMODE=disable` to localhost                   | Proxy encrypts laptop → GCP. Localhost hop is not TLS. That is expected for local, not the production posture.                                                        |

### Network / secrets that support encryption

- Removed `0.0.0.0/0` (“test access”) from Cloud SQL authorized networks. Public
  IP still exists; ACL is laptop `/32` only. Private VPC `default` is attached.
- `DB_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` are Cloud Run Secret Manager
  refs. Other vendor keys still live as Cloud Run env values and should move to
  secrets as HIPAA work starts.
- Local `npm run dev` shares this Cloud SQL with prod. QuickBooks token writes
  are blocked unless `K_SERVICE` (Cloud Run) or
  `QUICKBOOKS_ALLOW_TOKEN_WRITES=true`.

### What “encrypt more” would mean (not next)

| Option                           | Do now?                                                   |
| -------------------------------- | --------------------------------------------------------- |
| CMEK (Cloud KMS)                 | **Later** if a BAA/auditor requires customer-managed keys |
| App-level PHI column encryption  | **Not now** — breaks search/sort, key custody, restores   |
| Private IP only / drop public IP | **Sooner than CMEK** as HIPAA network hardening           |

---

## Starting HIPAA next — how this ties in

**P0 + encryption are prerequisites, not HIPAA compliance.** HIPAA is a program
(policies, BAAs, workforce, risk analysis, incident response) plus technical
safeguards. The app is in a better shape to _start_ that program.

### How the work maps to the Security Rule (technical)

| HIPAA technical safeguard (typical mapping) | What we already have                                                                                                | Gap to close next                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Access control                              | Authoritative roles from Cloud SQL; endpoint matrix; staff vs client from `/auth/me`; PHI omitted unless authorized | Workforce unique IDs, session timeout policy, emergency access procedure                   |
| Encryption at rest (addressable)            | Google-managed Cloud SQL + backups                                                                                  | Document the control; BAA with Google; CMEK only if required                               |
| Transmission security                       | HTTPS to Cloud Run; connector / `ENCRYPTED_ONLY` to SQL                                                             | Document; put CSP/HSTS on **Cloud Run frontend** (not `vercel.json`); retire Vercel origin |
| Audit controls                              | Safe logging (no PHI dumps); some request correlation                                                               | Systematic audit log of PHI access (who/when/which record, not values); retain per policy  |
| Integrity / authentication                  | Zod on migrated routes; webhook HMAC; OAuth state; intake honeypot/rate limit                                       | Expand validation; retire body `access_token`; MFA for staff if risk analysis says so      |

### HIPAA is not “turn on more encryption”

Start with a **risk analysis** and **Business Associate Agreements**, then use
this stack as evidence:

1. **Execute BAAs** — Google Cloud (Cloud SQL, Cloud Run, GCS). Then vendors
   that see PHI or auth: Supabase, SignNow, email, Stripe/QuickBooks if they
   handle identifiers. No BAA → that vendor is out of scope or must be replaced.
2. **Define the PHI inventory** — `phi_clients` and related Cloud SQL tables,
   documents in storage, emails, contracts. Minimum necessary already started in
   DTOs (PHI omitted when unauthorized).
3. **Write the technical safeguards** from this doc — encryption at rest/in
   transit, access matrix, intake abuse, webhook auth — as the System Security
   Plan, not as new code first.
4. **Move remaining Cloud Run plaintext secrets** into Secret Manager; rotate
   anything that was ever in git or chat logs.
5. **Audit + retention** — PHI read/write events without logging values;
   backup/PITR already on (7 days — confirm that matches the retention policy
   you will write).
6. **Decommission Vercel** — production is Cloud Run; leftover Vercel URLs in
   CORS/`FRONTEND_ORIGIN` are a compliance and cookie-origin risk.
7. **Policies / training / incident response** — engineering cannot finish HIPAA
   in the repo. Counsel + ops own that.

**Do not claim “HIPAA compliant”** after P0. Claim: encryption and access
controls required for a HIPAA environment are **in place on Cloud Run / Cloud
SQL** and are ready to be cited in a risk analysis.

**Local vs prod QuickBooks:** laptop `npm run dev` shares Cloud SQL with prod.
Token refresh/save/delete is blocked unless Cloud Run (`K_SERVICE`) or
`QUICKBOOKS_ALLOW_TOKEN_WRITES=true`. Use a sandbox company +
`QUICKBOOKS_ENVIRONMENT=sandbox` for local QB work.

---

## Verify

```bash
npm run build
npm test -- --runInBand --detectOpenHandles
npm run test:security-smoke
```

Deploy path: Cloud Build `test-gate` must pass before push/deploy.

---

## Related docs

- [`ENDPOINT_AUTHORIZATION_MATRIX.md`](./ENDPOINT_AUTHORIZATION_MATRIX.md)
- [`ROUTE_RESPONSE_CONTRACT_INVENTORY.md`](./ROUTE_RESPONSE_CONTRACT_INVENTORY.md)
- [`PILOT_JOURNEYS_AND_ROLLBACK.md`](./PILOT_JOURNEYS_AND_ROLLBACK.md)
- [`PRODUCTION_CLOUD_SQL_VERCEL.md`](./PRODUCTION_CLOUD_SQL_VERCEL.md)
- [`ARCHITECTURE_AUTH_AND_DATA.md`](./ARCHITECTURE_AUTH_AND_DATA.md)
- Feature package notes: `src/features/README.md`
- Staff CRUD audit (missing Supabase `users` → Cloud SQL):
  [`STAFF_PROFILE_CRUD_AUDIT.md`](./STAFF_PROFILE_CRUD_AUDIT.md)
