# Backend route and response-contract inventory (frozen baseline)

**Frozen for:** architecture handoff PR 2 (2026-08-11)  
**Source of truth:** `src/server.ts` mounts + `src/routes/*.ts` (prefer `.ts`
over paired `.js`)  
**Purpose:** Capture the public surface and response shapes before
security/structural refactors. Do not treat this as permission to change
contracts.

Auth legend:

- `public` — no session middleware on the route
- `cookie-auth` — `authMiddleware` (cookie `sb-access-token` / `X-Session-Token`
  / `Authorization: Bearer`)
- `role:…` — `authorizeRoles(...)` after auth

Response wrappers in the wild (must stay compatible):

- `{ success, data|error, meta? }` / `ApiResponse.*`
- Doula dashboard `{ success, clients|hours|activities|documents, … }`
- Admin doula directory `{ data, meta }`
- Portal `{ ok, … }` / `{ ok: false, error: { code, message } }`
- Raw arrays/objects (e.g. contract templates list)

---

## Root

| Method + path | Auth   | Contract                                                                                         |
| ------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `GET /`       | public | `200 { status: "ok" }`                                                                           |
| `GET /health` | public | `200 { status, service: "sokana-private-api", timestamp }` — keep lightweight; no DB/vendor deps |

---

## Auth

| Method + path                                                                          | Auth                      | Contract                                                        |
| -------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| `POST /login`                                                                          | public (alias)            | Same as `POST /auth/login`                                      |
| `POST /auth/login`                                                                     | public                    | `200 { message, user, token }`; sets httpOnly `sb-access-token` |
| `POST /auth/signup`                                                                    | public                    | `201 { message, user }`                                         |
| `GET /auth/me`                                                                         | token required by handler | `200` user (+ role); `401 { error, hint? }`                     |
| `GET /auth/users`                                                                      | cookie-auth               | `200` user[]                                                    |
| `POST /auth/logout`                                                                    | public                    | clears cookie; `{ message }`                                    |
| `GET /auth/verify`, `GET /auth/google`, `GET\|POST /auth/callback`                     | public                    | OAuth / verify flows                                            |
| `POST /auth/reset-password`, `GET /auth/password-recovery`, `PUT /auth/reset-password` | public                    | password recovery                                               |

---

## Public request intake

| Method + path                            | Auth       | Contract                                                                  |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `POST /requestService/requestSubmission` | **public** | `200 { message: "Form data received, onto processing" }`; `400 { error }` |

---

## Clients (aliases share one router)

Mounts: `/clients`, `/client`, `/api/clients`, `/api/client`

| Relative path                                    | Auth                               | Notes                                         |
| ------------------------------------------------ | ---------------------------------- | --------------------------------------------- |
| `GET /`                                          | cookie-auth · admin\|doula         | `ApiResponse.list`; may set `x-data-degraded` |
| `GET /:id`                                       | cookie-auth · admin\|doula\|client | `ApiResponse.success(client)`                 |
| `PUT\|PATCH /:id`                                | cookie-auth · admin\|doula\|client | update                                        |
| `PUT /status`                                    | cookie-auth · admin\|doula         | status DTO                                    |
| `DELETE /delete`                                 | cookie-auth · admin                | `204`                                         |
| `PUT /:id/phi`, `PUT /:id/birth-outcomes`        | cookie-auth · admin\|doula         | PHI / outcomes                                |
| Activities, assign-doula, booking-requests       | cookie-auth · roles vary           | assignment + activity flows                   |
| Billing + payment-schedule + installment invoice | cookie-auth · roles vary           | billing profile / schedules                   |
| `GET /me/portal-status`                          | cookie-auth · client               | `{ ok, portal_status, … }`                    |
| Documents (`/me` and `/:clientId`)               | cookie-auth                        | `{ success, documents\|url\|… }`              |
| Team CRUD under `/team/*`                        | cookie-auth · admin (mostly)       | team management                               |

---

## Doulas

### Admin directory — mounted at `/api` (`doulas.ts`)

| Method + path                                  | Auth                | Contract                                                                   |
| ---------------------------------------------- | ------------------- | -------------------------------------------------------------------------- |
| `GET /api/doulas`                              | cookie-auth · admin | `{ data, meta }` — **shadows** dashboard `GET /api/doulas/` for exact path |
| `GET\|PATCH /api/doula-assignments…`           | cookie-auth · admin | `{ data, meta? }`                                                          |
| `GET /api/clients/:clientId/doula-assignments` | cookie-auth · admin | `{ data, meta }`                                                           |
| `GET /api/doulas/:doulaId/availability`        | cookie-auth · admin | `{ data: { doulaId, availabilityStatus, records } }`                       |

### Doula dashboard — `/api/doulas` (`doulaRoutes.ts`)

| Method + path                                           | Auth                                         | Contract                                       |
| ------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `GET /api/doulas/clients`                               | cookie-auth · doula                          | `{ success, clients }` (+ optional `degraded`) |
| `GET /api/doulas/clients/:clientId`                     | cookie-auth · doula                          | `{ success, client }`                          |
| Activities / hours / availability / profile / documents | cookie-auth · doula (PATCH hours also admin) | `{ success, … }` wrappers                      |

---

## Admin

Prefix `/api/admin` — cookie-auth · **admin**

| Path                                               | Notes                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `POST /doulas/invite`                              | invite                                                       |
| `GET /clients/matching`, `POST /assignments/match` | matching                                                     |
| `POST /clients/:id/portal/invite\|resend\|disable` | `{ ok: true, lead… }` / `{ ok:false, error:{code,message} }` |
| Doula document review + URL                        | `{ success, documents\|document\|url, … }`                   |

---

## Contracts / signing / SignNow / PDF

| Mount                                     | Auth                                         | Notes                                                                                                     |
| ----------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/contracts` + `/api/contracts` templates | cookie-auth · admin                          | `GET /templates` → template array (`Cache-Control: no-store`); CRUD + generate                            |
| `/api/contract` postpartum                | mostly public today                          | calculate `{ success, amounts, fields }`; DocuSign send `410`; SignNow invite path                        |
| `/api/contract-signing`                   | **no auth middleware**                       | generate/send/status tooling — inventory only; harden in later PRs                                        |
| `/api/signnow`                            | callback public + HMAC (PR 5); tooling admin | `POST /callback` webhook `{ received, processed, documentId, … }` (+ `reason: duplicate`); tooling + send |

| `/api/pdf-contract` | **no auth** | PDF helpers / test routes |

---

## Billing / payments / invoices / financial

| Mount            | Auth                                | Contract                                            |
| ---------------- | ----------------------------------- | --------------------------------------------------- |
| `/api/billing`   | cookie-auth · admin\|billing        | `ApiResponse.list/success` for contracts + reminder |
| `/api/payments`  | mixed — some routes lack auth today | `{ success, data\|message }`                        |
| `/api/invoices`  | cookie-auth · admin\|doula          | `{ success, data }`                                 |
| `/api/financial` | cookie-auth · admin\|doula          | reconciliation JSON or CSV                          |

---

## QuickBooks (`FEATURE_QUICKBOOKS` only) + payment methods (always)

Mounts when `FEATURE_QUICKBOOKS` enabled:

- `/quickbooks`, `/api/quickbooks`
- `/quickbooks/customers`
- `/api/quickbooks/payment-methods`, `/quickbooks/payment-methods` (aliases)

Always mounted (needed by CRM Payment Schedule / card-on-file status even when
QB OAuth is off):

- `/api/payment-methods`

| Area                                                          | Auth                                             | Notes                                                |
| ------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| OAuth `GET /auth`, `/callback`                                | public                                           | connect flow                                         |
| Status, customers, invoices, create, disconnect, sync refresh | cookie-auth (after middleware)                   | CRM integrations                                     |
| `POST …/webhooks/invoice-paid`                                | public + Intuit HMAC (PR 5; before session auth) | `{ received: true }` (+ `duplicate: true` on replay) |
| `/quickbooks/customers` create + invoiceable                  | **no auth on that router today**                 | inventory risk for later hardening                   |
| Payment methods POST/GET `/api/payment-methods`               | cookie-auth · admin\|doula\|client               | `{ success, data }` — always mounted                 |

---

## Other mounts

| Prefix           | Notes                                                         |
| ---------------- | ------------------------------------------------------------- |
| `/email`         | cookie-auth; client-approval / team-invite                    |
| `/users`         | cookie-auth; profile + hours                                  |
| `/api/dashboard` | cookie-auth · admin; stats + calendar                         |
| `/debug`         | **only** when `!IS_PRODUCTION && ENABLE_DEBUG_ENDPOINTS=true` |

Not mounted in `server.ts` (present under `src/routes/`): `docusignRoutes`,
`stripePaymentRoutes`, `contractPaymentRoutes`.

---

## Pilot-critical freeze list

Preserve these shapes/status codes unless a later PR explicitly documents a
breaking fix:

1. `GET /health` → `{ status, service, timestamp }`
2. Login cookie + `{ message, user, token }`
3. Request intake `200 { message: "Form data received, onto processing" }` (PR
   8: domain/use-case behind façade; path unchanged)
4. Client list/detail `ApiResponse` wrappers
5. Doula dashboard `{ success, clients|hours|activities|documents }`
6. Admin `GET /api/doulas` `{ data, meta }`
7. Contract templates list/array + `Cache-Control: no-store`
8. Billing `ApiResponse.*`
9. Portal invite/status `{ ok, … }`
10. SignNow / QB webhook acknowledgement fields above

Aliases (`/client` vs `/clients`, `/api/client(s)`, `/contracts` vs
`/api/contracts`, QB dual mounts) stay until deprecation telemetry lands in a
later milestone.

## HTTP contracts (PR 7)

### Canonical envelope (migrated routes)

Prefer `ApiResponse` / `src/common/http/apiEnvelope.ts`:

- Success: `{ success: true, data, meta? }`
- Error: `{ success: false, error: string, code?: string }`

Stable codes live in `src/security/errorCodes.ts` (`UNAUTHENTICATED`,
`FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, …).

### Additive auth / legacy shapes (do not force-wrap)

| Surface                 | Success                                   | Error (additive `code` allowed)                                                         |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /health`           | `{ status, service, timestamp }`          | n/a                                                                                     |
| `POST /auth/login`      | `{ message, user, token }` + `Set-Cookie` | `{ error }` or validation `{ success:false, error, code:'VALIDATION_ERROR', details? }` |
| `GET /auth/me`          | flat user JSON                            | `{ error, code?, hint? }`                                                               |
| Auth middleware 401/403 | —                                         | `{ error, code?, hint? }` — status codes unchanged                                      |

### Zod validation

- Middleware: `src/middleware/validateRequest.ts` (`validateBody` /
  `{ body, params, query }`).
- Pilot schema: `loginBodySchema` on `POST /auth/login` and alias `POST /login`.

### Alias deprecation (no removals)

Headers on deprecated mounts: `Deprecation: true`, `Sunset`,
`Link: <successor>; rel="successor-version"`.

Instrumented aliases (telemetry counters, bodies unchanged):

- `POST /login` → `/auth/login` (`alias.login`)
- `/client` → `/clients` (`alias.client`)
- `/api/client` → `/api/clients` (`alias.api_client`)
