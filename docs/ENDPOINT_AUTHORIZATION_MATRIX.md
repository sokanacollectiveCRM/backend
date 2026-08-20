# Endpoint authorization matrix (PR 4)

**Status:** live policy as of 2026-08-12  
**Source of truth:** `src/server.ts` mounts + `src/routes/*.ts` +
`src/security/authorizationPolicies.ts`  
**Companion inventory:** `docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md` (response
shapes)

Classification legend:

| Classification            | Meaning                                             |
| ------------------------- | --------------------------------------------------- |
| Public                    | No user session required                            |
| Authenticated user        | Valid session; role may still be checked in handler |
| Client-owned resource     | Session + client may only access own resource       |
| Doula-owned resource      | Session + doula assignment / self scope             |
| Staff                     | `admin`, `billing`, and/or `doula` as listed        |
| Admin                     | `admin` only                                        |
| Provider callback/webhook | Externally reachable; provider auth in **PR 5**     |
| Internal maintenance      | Admin (or cron with admin credentials)              |
| Deprecated alias          | Same auth as canonical; do not remove yet           |

Middleware legend: `auth` = `authMiddleware`; `roles[...]` = `authorizeRoles`.

---

## Public allowlist (intentional)

| Method         | Canonical path                                    | Aliases                                 | Classification               | Allowed roles  | Ownership | Middleware                                                                          |
| -------------- | ------------------------------------------------- | --------------------------------------- | ---------------------------- | -------------- | --------- | ----------------------------------------------------------------------------------- |
| GET            | `/`                                               | —                                       | Public                       | —              | —         | none                                                                                |
| GET            | `/health`                                         | —                                       | Public                       | —              | —         | none                                                                                |
| POST           | `/login`                                          | —                                       | Public                       | —              | —         | none (auth entry)                                                                   |
| POST           | `/auth/login`                                     | —                                       | Public                       | —              | —         | none                                                                                |
| POST           | `/auth/signup`                                    | —                                       | Public                       | —              | —         | none                                                                                |
| POST           | `/auth/logout`                                    | —                                       | Public                       | —              | —         | none                                                                                |
| GET            | `/auth/verify`                                    | —                                       | Public                       | —              | —         | none                                                                                |
| GET            | `/auth/google`                                    | —                                       | Public                       | —              | —         | none (OAuth start)                                                                  |
| GET\|POST      | `/auth/callback`                                  | —                                       | Public                       | —              | —         | none (OAuth callback)                                                               |
| POST\|GET\|PUT | `/auth/reset-password`, `/auth/password-recovery` | —                                       | Public                       | —              | —         | none                                                                                |
| GET            | `/auth/me`                                        | —                                       | Authenticated user (handler) | any with token | —         | token read in controller                                                            |
| POST           | `/requestService/requestSubmission`               | —                                       | Public                       | —              | —         | none (intake)                                                                       |
| GET            | `/quickbooks/auth`                                | `/api/quickbooks/auth`                  | Public                       | —              | —         | none (OAuth)                                                                        |
| GET            | `/quickbooks/callback`                            | `/api/quickbooks/callback`              | Public                       | —              | —         | none (OAuth)                                                                        |
| POST           | `/api/signnow/callback`                           | —                                       | Provider callback/webhook    | —              | —         | HMAC `X-SignNow-Signature` (`SIGNNOW_WEBHOOK_SECRET`); idempotent event ledger      |
| POST           | `/quickbooks/webhooks/invoice-paid`               | `/api/quickbooks/webhooks/invoice-paid` | Provider callback/webhook    | —              | —         | HMAC `intuit-signature` (`QB_WEBHOOK_VERIFIER_TOKEN`); replay window + event ledger |

---

## Newly hardened in PR 4 (were anonymous — security bug fixes)

| Method | Canonical path                                                                                                                             | Aliases                            | Classification       | Allowed roles         | Ownership                  | Middleware                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | -------------------- | --------------------- | -------------------------- | ------------------------------------ |
| GET    | `/api/payments/dashboard`                                                                                                                  | —                                  | Staff                | admin, billing        | —                          | auth + roles                         |
| GET    | `/api/payments/overdue`                                                                                                                    | —                                  | Staff                | admin, billing        | —                          | auth + roles                         |
| GET    | `/api/payments/due-between`                                                                                                                | —                                  | Staff                | admin, billing        | —                          | auth + roles                         |
| GET    | `/api/payments/status/:status`                                                                                                             | —                                  | Staff                | admin, billing, doula | —                          | auth + roles                         |
| PUT    | `/api/payments/payment/:paymentId/status`                                                                                                  | —                                  | Staff                | admin, billing        | —                          | auth + roles                         |
| POST   | `/api/payments/maintenance/daily`                                                                                                          | —                                  | Internal maintenance | admin                 | —                          | auth + roles                         |
| POST   | `/api/payments/maintenance/overdue-flags`                                                                                                  | —                                  | Internal maintenance | admin                 | —                          | auth + roles                         |
| GET    | `/api/payments/contract/:contractId/summary`                                                                                               | —                                  | Client-owned / staff | admin, doula, client  | client → own contract only | auth + roles + ownership             |
| GET    | `/api/payments/contract/:contractId/schedule`                                                                                              | —                                  | Client-owned / staff | admin, doula, client  | client → own contract only | auth + roles + ownership             |
| \*     | `/api/contract-signing/*`                                                                                                                  | —                                  | Admin                | admin                 | —                          | auth + roles (router)                |
| \*     | `/api/contract/*`                                                                                                                          | —                                  | Admin                | admin                 | —                          | auth + roles (router)                |
| \*     | `/api/pdf-contract/*`                                                                                                                      | —                                  | Admin                | admin                 | —                          | auth + roles (router)                |
| POST   | `/api/signnow/test-*`, `/list-templates`, `/template-fields`, `/postpartum-template-fields`, `/debug-clone-fields`, `/send-client-partner` | —                                  | Admin                | admin                 | —                          | auth + roles (after public callback) |
| POST   | `/quickbooks/customers`                                                                                                                    | —                                  | Staff                | admin, billing        | —                          | auth + roles                         |
| GET    | `/quickbooks/customers/invoiceable`                                                                                                        | —                                  | Staff                | admin, billing        | —                          | auth + roles                         |
| \*     | `/quickbooks/*` CRM ops (status, invoices, customers, disconnect, invoice, sync)                                                           | `/api/quickbooks/*`                | Staff                | admin, billing        | —                          | auth + roles                         |
| POST   | `/quickbooks/simulate-payment`                                                                                                             | `/api/quickbooks/simulate-payment` | Admin                | admin                 | —                          | auth + roles                         |
| POST   | `/email/client-approval`, `/email/team-invite`                                                                                             | —                                  | Admin              | admin                 | —                          | auth + roles                         |

### HIPAA-13A containment (2026-08-20)

| Method | Canonical path        | Aliases                                              | Classification | Allowed roles | Ownership | Middleware       |
| ------ | --------------------- | ---------------------------------------------------- | -------------- | ------------- | --------- | ---------------- |
| GET    | `/clients/fetchCSV`   | `/client/fetchCSV`, `/api/clients/fetchCSV`, `/api/client/fetchCSV` | Admin          | admin only    | —         | auth + roles     |

Previously allowed `client` and exported a 4-column subset. As of 2026-08-20,
admin export is `SELECT * FROM phi_clients` (all columns). See
`docs/HIPAA_13A_CLIENT_CSV_EXPORT_STATUS.md`.

Already-auth `GET /api/payments` and `GET /api/payments/contract/:id/history`
unchanged (roles tightened only where listed above for history ownership
behavior).

---

## Already protected (unchanged behavior summary)

| Area               | Canonical mounts / aliases                                                               | Classification                     | Roles (typical)                               |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| Clients            | `/clients`, `/client`, `/api/clients`, `/api/client`                                     | Staff / Client-owned / Doula-owned | per-route admin\|doula\|client\|billing       |
| Doula dashboard    | `/api/doulas/*`                                                                          | Doula-owned / Staff                | doula, admin                                  |
| Admin directory    | `/api/doulas`, `/api/doula-assignments`, …                                               | Admin                              | admin                                         |
| Admin ops          | `/api/admin/*`                                                                           | Admin                              | admin                                         |
| Contract templates | `/contracts/templates`, `/api/contracts/templates`                                       | Admin                              | admin                                         |
| Billing            | `/api/billing/*`                                                                         | Staff                              | admin, billing                                |
| Invoices           | `/api/invoices`                                                                          | Staff                              | admin, doula                                  |
| Financial          | `/api/financial/*`                                                                       | Staff                              | admin, doula                                  |
| Dashboard          | `/api/dashboard/*`                                                                       | Admin                              | admin                                         |
| Payment methods    | `/api/payment-methods`, `/api/quickbooks/payment-methods`, `/quickbooks/payment-methods` | Client-owned / Staff               | admin, doula, client (+ controller ownership) |
| Users              | `/users/*`                                                                               | Authenticated user                 | cookie-auth                                   |
| Auth users list    | `/auth/users`                                                                            | Authenticated user                 | auth                                          |

---

## Debug (non-production)

| Method | Path                   | Classification                   | Notes                                                                                                                                                        |
| ------ | ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/debug/session-token` | Internal maintenance / exception | Only when `!IS_PRODUCTION && ENABLE_DEBUG_ENDPOINTS=true`; password bootstrap — **not** put behind cookie auth (would defeat purpose). Documented exception. |
| GET    | `/debug/whoami`        | Authenticated user               | authMiddleware                                                                                                                                               |

---

## Ownership policies

Implemented in `src/security/authorizationPolicies.ts`:

- `roleAllows` — role allowlist
- `decideOwnershipAccess` — staff-or-owner
- `decideClientResourceAccess` — client may only use own `clientId`
- Payment contract summary/schedule: clients checked via
  `contractService.getContractWithClient` → `contract.client_id`
- Existing: PHI via `canAccessSensitive`; payment methods via controller
  `resolveAuthorizedClientId`; payment history filters by own client id

---

## Ambiguous / deferred decisions

| Route / topic                                                                      | Decision needed                                                                                          |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Whether `billing` role should access `/api/payments` list (currently admin\|doula) | Product: align list with billing dashboard roles or keep Financial-tab doula access                      |
| DocuSign routes under `src/routes/docusignRoutes.ts`                               | **Not mounted** in `server.ts` — no runtime change; confirm before re-enabling                           |
| `stripePaymentRoutes` / `contractPaymentRoutes`                                    | **Not mounted** — same                                                                                   |
| Provider webhook signature/replay                                                  | **Done (PR 5)** — HMAC + `webhook_events` ledger; OAuth state in `oauth_states`                          |
| Authoritative role storage (ignore `user_metadata`)                                | **Done (PR 6)** — Cloud SQL admins/doulas + app-managed `public.users.role`; metadata never grants staff |

---

## Verification notes

- Aliases inherit the same router middleware as canonical mounts.
- Newly denied anonymous calls return existing auth shapes (`401`
  `{ error, hint? }` / `403`
  `{ error: 'Forbidden: Insufficient permissions' }`).
- Provider webhooks remain externally reachable without CRM cookies; they
  require provider HMAC when secrets are configured (always in production).
- QuickBooks OAuth `state` is cryptographically random, stored, TTL-bound, and
  single-use (`oauth_states`).
- Staff roles are resolved from Cloud SQL team tables / app-managed
  `public.users.role` only (`user_metadata` is ignored for authorization).
- Session cookie canonical name is `sb-access-token`; legacy `session` cookie is
  accepted temporarily with telemetry.
