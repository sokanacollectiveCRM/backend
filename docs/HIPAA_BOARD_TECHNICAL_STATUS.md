# HIPAA board — technical status (re-verified 2026-08-20)

**Scope:** Code and infra docs in `backend` and `frontend-crm`. Not a legal
HIPAA determination. Not an attestation that BAAs, policies, or training exist.

**Method:** Re-checked the board outline against
`docs/HIPAA_TECHNICAL_PHI_INVENTORY.md` (2026-08-17),
`docs/SECURITY_P0_HARDENING_SUMMARY.md` (2026-08-14),
`docs/CLOUD_SQL_NETWORK_HARDENING.md` (through Phase 4, 2026-08-19), and current
source in both repositories.

**Board conclusion stands:** the board is outdated. Several tasks have started.
Only **HIPAA-02** is reported complete, and that completion is **not verifiable
from code**.

| Bucket                         | Count |
| ------------------------------ | ----- |
| Done (operational report only) | 1     |
| In progress / partial          | 11    |
| Not started / not evidenced    | 6     |

---

## Done: 1

### HIPAA-02 — Sokana–Techluminate BAA

- **Board:** Complete if the signed agreement and effective date are stored as
  stated.
- **Code:** No BAA artifact, date, or vendor register field exists in either
  repo. Engineering cannot confirm this.

---

## In progress or partially complete: 11

### HIPAA-05 — Technical safeguards

**Partial.** P0 hardening shipped 2026-08-14: authoritative roles, endpoint
matrix, webhook HMAC/replay/idempotency, intake abuse protection, encryption at
rest/in transit (Google-managed), Cloud Run deploy test gates.

**Still open (code-verified):**

| ID     | Finding                                                                | Evidence                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-02 | `GET /clients/fetchCSV` was open to `client` and exported all families | **Contained 2026-08-20:** admin-only route + use case; see `docs/HIPAA_13A_CLIENT_CSV_EXPORT_STATUS.md`. Residual: admin exports **all** `phi_clients` columns for all rows (`SELECT *`). |
| INV-09 | Any authenticated user can write hours for any client                  | `src/routes/specificUserRoutes.ts` `POST /:id/addhours` is session-only; `userController.addNewHours` trusts body `doula_id` / `client_id`                                                |
| INV-01 | Public intake emails full clinical + identity payload to Gmail         | `requestFormController.ts` staff email includes health history, address, income, due date                                                                                                 |
| INV-10 | Live `POST /quickbooks/simulate-payment` accepts PAN/CVC               | `quickbooksRoutes.ts` (admin) → `paymentsController` / `createCharge.ts` / `buildChargePayload.ts`                                                                                        |
| INV-11 | Hardcoded Gmail app password in repo                                   | `src/scripts/sendTestEmail.ts`                                                                                                                                                            |
| INV-12 | Birth-outcomes write assignment check (`canAccessSensitive`)           | **Closed (2026-08-23)** — see `docs/HIPAA_INV12_BIRTH_OUTCOMES_ASSIGNMENT_STATUS.md`                                                                                                      |
| INV-03 | Any authenticated doula can read another family's operational profile  | `GET /clients/:id`                                                                                                                                                                        |
| —      | Client document **files** remain in Supabase Storage                   | `clientDocumentUploadService.ts`                                                                                                                                                          |
| —      | Cloud SQL public IP still enabled                                      | Hardening Phase 7 not started; last verify 2026-08-19 `ipv4Enabled: true`                                                                                                                 |
| —      | Vercel not retired                                                     | Both repos still have `vercel.json`; backend CORS still lists `*.vercel.app`                                                                                                              |

### HIPAA-07 — Sensitive logging

**Frontend SPA: remediated 2026-08-22** (pending Cloud Run deploy). Direct
`console.log` / `console.debug` removed from `src/` (except centralized logger).
Sensitive error paths use metadata-only `safeLog`. CI gate:
`npm run check:sensitive-logging`. Evidence:
`docs/HIPAA_07_FRONTEND_LOGGING_SCAN.md`,
`docs/HIPAA_07_FRONTEND_LOGGING_SIGNOFF.md`.

Backend request logger allowlists route metadata (`safeLogging.ts`); production
`console.*` is no-op on the API.

Previously open frontend PHI logging paths are closed in code:

- ~~`updateClient.ts` — client ID, full update payload, error body, returned
  client~~
- ~~`deleteClient.ts` — client ID~~
- ~~`createContract.ts` — contract body~~
- ~~`LeadProfileModal.tsx`, `Clients.tsx`, `doulaService.ts`~~

### HIPAA-13 — Technical security remediation

**Partial.** P0 auth/webhook/intake work is in. **HIPAA-13A / INV-02 CSV role
containment shipped 2026-08-20** (`docs/HIPAA_13A_CLIENT_CSV_EXPORT_STATUS.md`).
Other critical/high findings above are not all closed.

### HIPAA-15 — Vendor / BAA review

**Partial (operational).** Techluminate reported complete; Google Cloud reported
accepted. Code cannot prove any BAA.

Still in the live data path without in-repo BAA evidence: Google Workspace /
Gmail SMTP, SignNow, Intuit QuickBooks, Supabase Auth + Storage, CloudConvert.

### HIPAA-17 — Access / onboarding / offboarding

**Partial.** Application roles exist (`admin`, `billing`, `doula`, `client`) and
staff is not granted from `user_metadata`. Procedures, periodic access review,
termination evidence, and several authorization gaps (CSV, hours, birth
outcomes, unassigned doula reads) remain.

### HIPAA-06 — Session controls

**Partial.** Frontend idle logout is **15 minutes** with a 13-minute warning and
cross-tab sync (`useIdleTimeout.ts`). Cookie is HttpOnly/Secure (prod) with
**1-hour** `maxAge` (`sessionCookies.ts`). That does not match a one-hour
inactivity policy. No server-side session invalidation or concurrent-session
limit.

### HIPAA-08 — Audit trail

**Partial.** Notes, some email sends, HTTP request logs, and webhook event keys
exist. There is no systematic audit log of PHI access, role changes,
deactivation, contracts, or billing (who / when / which record, without values).

### HIPAA-09 — Vendor inventory

**Partial.** Technical vendor table is in `HIPAA_TECHNICAL_PHI_INVENTORY.md` §6.
Agreement copies, configuration evidence, and an approved register are not in
the repo.

### HIPAA-10 — Risk / remediation register

**Partial.** Inventory + P0 summary identify risks. There is no approved,
scored, living risk register.

### HIPAA-19 — Workforce training

**Not evidenced in code.** Training acknowledgments cannot be verified from the
application.

### HIPAA-20 — Safeguard testing / evidence

**Partial.** Backend `npm test` + `test:security-smoke` are deploy gates. The
full administrative / technical / operational evidence package is not assembled.

---

## Not started or not evidenced: 6

These have no implementation or in-repo evidence:

- **HIPAA-11** — Legal HIPAA status determination
- **HIPAA-12** — Formal security risk assessment
- **HIPAA-14** — Approved privacy and security policies
- **HIPAA-16** — Incident-response and breach-notification procedures
- **HIPAA-18** — Retention, disposal, and client-rights procedures
- **HIPAA-21** — Final leadership / legal readiness review

---

## First engineering work (code, in this order)

Board-proposed first five, confirmed still open, plus four additional P0s that
are equally blocking from a technical standpoint.

### Do first (authorization / disclosure)

1. **CSV export (INV-02) — P0**  
   Restrict `GET /clients/fetchCSV` to `admin` (drop `client`). Stop exporting
   every row of name / income / address. Add the route to the authorization
   matrix and a regression test.

2. **Frontend PHI logging (HIPAA-07) — P0/P1**  
   Remove `console.log` of client ID, update payload, error body, and returned
   client in `updateClient.ts`. Same class of leak in `deleteClient.ts`,
   `createContract.ts`, `LeadProfileModal.tsx`, `Clients.tsx`,
   `doulaService.ts`.

3. **Birth-outcomes assignment (INV-12) — closed 2026-08-23**  
   `updateClientBirthOutcomes` now calls `canAccessSensitive` before DB access.
   Evidence: `docs/HIPAA_INV12_BIRTH_OUTCOMES_ASSIGNMENT_STATUS.md`.

4. **Assignment emails (HIPAA-05 email path)**  
   `sendDoulaMatchNotification` includes client email and optional assignment
   notes. Minimize to name + dashboard link unless leadership explicitly
   requires email in the body. Intake staff email (INV-01) is a larger PHI dump
   than assignment mail.

5. **QuickBooks authorization exposure**  
   Historical screenshot exposed access/refresh tokens. Rotate/revoke in Intuit,
   reconnect OAuth, document the incident. Tokens remain plaintext in Cloud SQL
   `quickbooks_tokens` (INV follow-up).

### Same-sprint P0s still in code (do not skip)

6. **Hours IDOR (INV-09)** — `POST /users/:id/addhours` needs role + assignment;
   ignore body `doula_id` except admin.
7. **Intake Gmail (INV-01)** — stop emailing health history / address / income;
   notify with client number + CRM link.
8. **Simulate-payment PAN (INV-10)** — unmount
   `POST /quickbooks/simulate-payment` in all environments.
9. **Hardcoded SMTP secret (INV-11)** — rotate the Gmail app password; remove
   the secret from `sendTestEmail.ts` (do not copy the value into tickets).

### Infra / vendor (not closable by app patch alone)

- Disable Cloud SQL public IP (hardening Phase 7).
- Retire Vercel (`vercel.json` + CORS `*.vercel.app` origins).
- Decide/approve Supabase Storage for client insurance-card files, or move bytes
  off Supabase.
- Execute remaining BAAs (Workspace, SignNow, Intuit, Supabase, CloudConvert).

---

## What this does _not_ change

Engineering cannot mark HIPAA-11 through HIPAA-21 complete. P0 + encryption are
prerequisites, not compliance. Do not claim the system is HIPAA-compliant from
this update.
