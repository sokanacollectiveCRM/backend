# Handoff: Backend modular-monolith architecture boundary refactor

## Metadata

- Direction: `architecture-assessment->backend`
- Priority: `P0` (security + quality gates first; structural P1/P2 after)
- Requested By: architecture assessment (read-only analysis 2026-08-10)
- Date: `2026-08-10`
- Status: `in_progress`
- Related Links:
  - `docs/Backend_Architecture_Boundary_Assessment.docx`
  - `docs/SECURITY_P0_HARDENING_SUMMARY.md` (P0 security what-was-done + GCP
    encryption guidance)
  - Companion frontend handoff:
    `sokana-crm-frontend/frontend-crm/.cursor/handoffs/open/2026-08-10-frontend-architecture-boundary-refactor.md`

## Why This Is Needed

- Pilot system has substantial architectural debt but is viable; do **not**
  rewrite.
- Most urgent work is security containment, auth/webhook hardening, and test/CI
  gates—not folder reorganization.
- Goal: incremental, feature-packaged modular monolith (ports/adapters) while
  preserving Cloud Run services, databases, public URLs, and API behavior.

## Current Behavior

- Express modular monolith (`sokana-private-api`) with partial composition root;
  many routes/controllers construct services/repos/vendor clients directly.
- Multiple route aliases increase public surface (`/clients`, `/client`,
  `/api/clients`, `/api/client`, etc.).
- Mixed auth/cookie/token patterns; some payment/contract/signing/debug routes
  lack consistent guards.
- Webhooks lack clear provider signature/replay protection; QB webhook may be
  behind user auth incorrectly.
- Large controllers mix business rules and infrastructure; repository interfaces
  are broad/`any`-heavy.
- ~72 paired `.js`/`.ts` sources; env access often bypasses `config/env.ts`.
- Backend: typecheck passes; **38 suites / 300 tests pass**; Jest open handle +
  noisy logs; lint ~418 errors; tests not mandatory in CI deploy gate.

## Expected Behavior

- Stabilize → capture behavior → extract pure rules → introduce ports → adapters
  → switch one endpoint → monitor → remove old path later.
- Domain code imports nothing from Express/DB/SDKs/env; use cases depend on
  small interfaces; composition at the edge.
- One canonical API error envelope; Zod at body/params/query for migrated
  routes; authoritative server-managed roles.
- P0 security and quality work completed before broad structural migration.

## Principles (Essentials.dev)

- Preserve behavior before restructuring (characterization tests).
- Functional core, imperative shell.
- Dependency inversion via small ports.
- Explicit boundary contracts; untrusted I/O validated at edges.
- Make invalid states hard to represent; typed domain errors mapped to stable
  API codes.
- High cohesion / single responsibility; dependency direction over folders.
- Refactor through seams; remove legacy only after telemetry proves unused.

---

## Requested Changes

### P0 — pilot protection and security

- [x] Remove localhost telemetry from `clientController` (`127.0.0.1:7707`).
- [x] Build explicit endpoint authorization matrix; protect payment, contract,
      template, debugging, invitation routes.
- [x] Make DB/app-managed role data authoritative; never grant staff from
      `user_metadata`.
- [x] Add signature verification, replay prevention, and idempotency to SignNow
      and QuickBooks webhooks.
- [x] Move provider webhooks outside user-session auth while retaining provider
      authentication.
- [x] Replace QuickBooks OAuth state with cryptographically random, stored,
      expiring, single-use value.
- [x] Redact SignNow, email, contract-field, token, and PHI logging.
- [x] Stop returning stacks and raw provider payloads to clients.
- [x] Stabilize cookie naming and auth failure behavior.
- [x] Begin token transport migration (dual-support → measure → retire
      JSON/query tokens after compatibility proven).
- [x] Add rate limiting, idempotency, and abuse protection to public request
      submission.
- [x] Fix backend Jest open handles.
- [x] Make backend tests and security smoke tests mandatory before deployment.

### P1 — structural improvements without product changes

- [x] Define one canonical API success/error envelope with stable
      machine-readable error codes.
- [x] Apply Zod validation to body, params, and query at every migrated route.
- [ ] Select TypeScript as authoritative source; remove paired JS only after
      import/build audit.
- [ ] Enable strict TypeScript incrementally by migrated module.
- [ ] Extract client, assignment, contract, billing, and portal use cases from
      largest controllers.
- [ ] Break repository interfaces into use-case-focused ports.
- [ ] Move all environment access behind validated configuration.
- [ ] Make backend client-status handling the sole owner of QuickBooks sync; add
      idempotency/outbox before FE removal.
- [ ] Introduce migration ledger, checksums, transactions where supported,
      pre/post-deploy checks.
- [ ] Add structured correlation IDs and safe audit events.
- [x] Add deprecation telemetry and headers to legacy route aliases (do not
      remove yet).

### P2 — after pilot validation

- [ ] Retire unused API aliases and legacy API feature flag.
- [ ] Retire legacy Supabase data paths after Cloud SQL SoT verification.
- [ ] Complete remaining feature-package migrations (`clients`, `intake`,
      `matching`, `portal`, `contracts`, `billing`, `auth`, `doulas`,
      `documents`).
- [ ] Consolidate/baseline historical migrations only after backup/restore
      proof.
- [ ] Decide SignNow vs DocuSign support scope.
- [ ] Remove obsolete repository/service/type implementations.
- [ ] Consider shared generated contracts only after backend contracts
      stabilize.
- [ ] Performance work from production traces (not component size alone).
- [ ] Do **not** split Cloud Run into more services now.

### Implementation milestones (one scoped PR each)

Do not implement this handoff as one large PR. Create one implementation
ticket/PR per milestone and update this checklist as each is verified.

- [x] **PR 1 — Feature-package guardrails:** add `src/features/README.md`;
      document package ownership, allowed dependency direction, public
      entrypoints, and the target intake package. This PR defines the structure
      only and does not move production code.
- [x] **PR 2 — Baseline and CI (2–4d):** freeze the route/response inventory;
      record the 300-test baseline; fix the Jest open handle; require tests and
      security smoke in CI; document pilot-critical journeys and rollback
      owners.
- [x] **PR 3 — Immediate containment:** remove localhost telemetry; redact
      sensitive logging; stop returning stacks and raw provider payloads;
      preserve current client-visible contracts unless an exposure requires a
      documented fix.
- [x] **PR 4 — Endpoint authorization:** define the public/protected endpoint
      and role matrix; protect payment, signing, template, invitation,
      maintenance, and debugging operations; add auth/role matrix tests.
- [x] **PR 5 — Webhooks and OAuth:** verify provider signatures; add replay
      prevention and idempotency; mount webhooks outside user-session auth;
      implement cryptographically secure, stored, expiring, single-use OAuth
      state.
- [x] **PR 6 — Authentication compatibility:** make server-managed roles
      authoritative; standardize cookie handling; add dual-support for the
      target auth transport; measure legacy usage before retiring JSON/query
      token delivery.
- [x] **PR 7 — HTTP contracts (1–2w):** introduce canonical errors and Zod
      schemas incrementally; preserve fields, aliases, and status codes; add
      deprecation telemetry without removing routes.
- [x] **PR 8 — First structural slice (1–2w):** migrate **request intake**
      first. Characterize the public submission behavior; extract pure
      validation and normalization rules; introduce application ports/adapters
      behind the existing route/controller façade; shadow-compare results; keep
      the old path available for one monitored release window.
- [ ] **Later slices:** portal eligibility → client status/QuickBooks sync →
      doula matching → contracts → billing → documents/PHI.

Ordering rule: establish the feature-package convention first, then complete the
P0 security and quality gates before moving production files. This avoids mixing
path churn with security-sensitive changes while still making the intended
architecture explicit from the first PR.

### Completion summary (PR 1)

- Status set to `in_progress`; PR 1 marked complete.
- Added `src/features/README.md` with feature-first packaging, dependency
  direction, public entrypoints, bootstrap/shared rules, and the target `intake`
  package layout.
- No production packages created, no imports/routes moved, no runtime behavior
  changes.
- Next milestone after PR 1 was PR 2 (baseline and CI); that work is complete.
  Do not start structural file moves until P0 gates allow.

### Completion summary (PR 2)

- Frozen route/response inventory: `docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md`.
- Pilot journeys + rollback: `docs/PILOT_JOURNEYS_AND_ROLLBACK.md`.
- Test baseline confirmed: 38 suites / 300 tests minimum; after security-smoke
  scaffold → 39 suites / 303 tests passing.
- Jest open handle fixed without `--forceExit` (DELETE `/clients/delete` suite
  no longer leaves a supertest server handle).
- GitHub Actions gate: `.github/workflows/test.yml` (Node 20) runs `npm ci`,
  `npm run build`, `npm test -- --runInBand`, `npm run test:security-smoke`.
- **PR 2.1 — Deployment gate alignment:** Cloud Build (`cloudbuild.yaml`) now
  enforces the same gate before buildpack/push/deploy (`test-gate` → `buildpack`
  → `push` → `deploy` via `waitFor`). Lint workflow updated to Node 20
  (`actions/checkout@v4`, `actions/setup-node@v4`).
- Next milestone: PR 3 (immediate containment). No security route hardening or
  folder moves in this PR.

### Completion summary (PR 3)

- Status remains `in_progress` (epic not closed). PR 3 marked complete; endpoint
  authorization remains **PR 4**.
- Baseline before PR 3: 39 suites / 303 tests. After PR 3: **40 suites / 308
  tests** (build + `npm test -- --runInBand --detectOpenHandles` +
  security-smoke pass; no open-handle report).
- Removed `127.0.0.1:7707` telemetry from `clientController.assignDoula`
  (IDs/roles/services were being exfiltrated).
- Redacted sensitive logging: email SMTP password previews; SignNow auth params
  / field values / token prefixes / Bearer headers; contract field value dumps;
  provider raw payloads.
- Removed hardcoded SignNow API token from `signNowService.js` and
  `pdfContractRoutes` (runtime auth / env only).
- Sanitized unexpected 500 responses to stable non-sensitive messages via
  `SAFE_INTERNAL_ERROR_MESSAGE` / `toSafeClientErrorBody` (domain 4xx messages
  preserved).
- **Intentional error-response security bug fixes (status codes preserved where
  possible):**
  - `contractSigningRoutes`: dropped `details` containing `error.stack` /
    `error.response.data`.
  - `contractRoutes` send-client-invite: dropped `details: error.response?.data`
    and raw `error.message` on 500.
  - `signNowRoutes` send-client-partner: dropped
    `details: error.response.data.errors` and provider error messages (429
    daily-limit message retained).
  - `clientController` / `authController` handleError: unexpected 500 →
    `Internal Server Error` (no SQL/provider text).
  - `emailController`: 500 → generic failed-email / internal messages (no
    stack).
  - `quickbooksController`: dropped `details: err.message`; OAuth error redirect
    no longer embeds raw message.
  - `paymentRoutes` / `paymentMethodController` / `pdfContractRoutes`:
    unexpected 500s use generic safe messages.
- Regression tests: `src/__tests__/immediateContainment.test.ts`.
- **Deferred to PR 4 (documented, auth unchanged):** unauthenticated
  `/api/contract-signing/*`, `/api/signnow/*` tooling, `/api/pdf-contract/*`,
  many `/api/payments/*` dashboard/maintenance routes, `/quickbooks/customers`
  outside auth middleware, public request intake (intentional), QB webhook
  session-auth mismatch.
- Changed files (PR 3 only): `clientController.ts`, `authController.ts`,
  `emailController.ts`, `emailService.ts`, `paymentMethodController.ts`,
  `quickbooksController.ts`, `contractSigningRoutes.ts`, `contractRoutes.ts`,
  `signNowRoutes.ts`, `paymentRoutes.ts`, `pdfContractRoutes.ts`,
  `signNowService.ts`, `signNowService.js`, `signNowContractProcessor.ts`,
  `safeLogging.ts`, `sendTestEmail.ts`, `immediateContainment.test.ts`,
  `requestEndpoint.test.ts` (email throw assertion), handoff + frontend-context.

### Completion summary (PR 4)

- Status remains `in_progress`. PR 4 marked complete; **webhook provider
  authentication remains PR 5**.
- Authorization matrix: `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`.
- Policies: `src/security/authorizationPolicies.ts` (`roleAllows`,
  `decideOwnershipAccess`, `decideClientResourceAccess`).
- Baseline before PR 4: 40 suites / 308 tests. After PR 4: **41 suites / 334
  tests** (build + `npm test -- --runInBand --detectOpenHandles` +
  security-smoke; no open-handle report).
- **Routes newly protected (anonymous access denied — security bug fixes):**
  - Payments: `/dashboard`, `/overdue`, `/due-between`, `/status/:status`,
    `PUT /payment/:paymentId/status`, `/maintenance/*`, plus ownership on
    `/contract/:id/summary|schedule`.
  - `/api/contract-signing/*`, `/api/contract/*`, `/api/pdf-contract/*` → admin.
  - `/api/signnow/*` tooling + `send-client-partner` → admin (`/callback` stays
    public).
  - `/quickbooks/customers` + `/invoiceable` → admin|billing.
  - QB CRM ops after session auth → admin|billing; `simulate-payment` → admin.
  - `/email/*` → admin role (was session-only).
- **QB webhook** `POST …/webhooks/invoice-paid` moved **before**
  `authMiddleware` so providers can reach it without CRM cookies
  (signature/replay still PR 5).
- Tests: `src/__tests__/authorizationMatrix.test.ts` (+ smoke baseline doc
  link).
- Ambiguous / deferred: billing vs doula on `GET /api/payments` list; unmounted
  DocuSign/Stripe route files; debug `/session-token` env exception; PR 5
  webhook crypto; PR 6 authoritative roles.

### Completion summary (PR 5)

- Status remains `in_progress`. PR 5 marked complete; next milestone is **PR 6
  (Authentication compatibility)**.
- Baseline before PR 5: 41 suites / 334 tests. After PR 5: **42 suites / 345
  tests** (build + `npm test -- --runInBand --detectOpenHandles` +
  security-smoke; no open-handle report).
- SignNow: `requireSignNowWebhookAuth` verifies `X-SignNow-Signature` HMAC
  (`SIGNNOW_WEBHOOK_SECRET`); event ledger via `webhook_events` / memory in
  tests; duplicate deliveries return `reason: 'duplicate'`.
- QuickBooks: `requireQuickBooksWebhookAuth` verifies `intuit-signature` with
  verifier token + optional `intuit-created-time` freshness; ledger keyed by
  `intuit-t-id` or `qbo:invoice:{id}:paid`.
- Webhooks remain outside CRM session auth (PR 4 mount order preserved).
- OAuth: `createOAuthState` / `consumeOAuthState` — `crypto.randomBytes`
  base64url, stored in `oauth_states`, 10m TTL, single-use; consumed in
  `handleAuthCallback` before token exchange.
- Additive migration (manual):
  `src/db/migrations/add_webhook_events_and_oauth_states.sql`.
- Env: `SIGNNOW_WEBHOOK_SECRET`, `QB_WEBHOOK_VERIFIER_TOKEN` (documented in
  `.env.example`); production fails closed if missing.
- Raw body capture on `express.json` for HMAC.
- Tests: `src/__tests__/webhookAndOauthSecurity.test.ts` (+ SignNow duplicate
  coverage).
- Docs: auth matrix + route inventory updated for PR 5.
- No feature-folder moves; FE `{ url }` OAuth contract unchanged.

### Completion summary (PR 6)

- Status remains `in_progress`. PR 6 marked complete; next milestone is **PR 7
  (HTTP contracts)**.
- Baseline before PR 6: 42 suites / 345 tests. After PR 6: **43 suites / 354
  tests** (build + `npm test -- --runInBand --detectOpenHandles` +
  security-smoke; no open-handle report).
- Authoritative roles: `src/security/resolveAuthoritativeRole.ts` — Cloud SQL
  `admins`/`doulas` (and `phi_clients` for client hint) + app-managed
  `public.users.role`; **never** grant staff from
  `user_metadata`/`app_metadata`.
- Removed `/auth/me` metadata role override; login/`getMe`/`getUserFromToken`
  all resolve via authoritative path.
- Cookies: canonical `sb-access-token` via `setSessionCookie` /
  `clearSessionCookies`; OAuth + `POST /auth/callback` no longer set legacy
  `session` (still accepted temporarily for dual-support).
- Transport priority: `X-Session-Token` → Bearer → `sb-access-token` → legacy
  `session` cookie. JSON login `token` and body `access_token` retained with
  telemetry counters (`authTransportTelemetry`) — not retired yet.
- Tests: `src/__tests__/authCompatibility.test.ts`.
- Docs: auth matrix updated. No feature-folder moves; FE login/`/auth/me` shapes
  preserved.

### Completion summary (PR 7)

- Status remains `in_progress`. PR 7 marked complete; next milestone is **PR 8
  (request intake structural slice)**.
- Baseline before PR 7: 43 suites / 354 tests. After PR 7: **44 suites / 362
  tests** (build + `npm test -- --runInBand --detectOpenHandles` +
  security-smoke; no open-handle report).
- Canonical helpers: `src/common/http/apiEnvelope.ts`,
  `src/security/errorCodes.ts`; existing `ApiResponse` retained.
- Zod: upgraded `validateRequest` for body/params/query; pilot `loginBodySchema`
  on `POST /auth/login` and alias `POST /login`. Login success shape unchanged.
- Additive `code` on auth middleware / authorizeRoles / safe 5xx / global
  handler — `error` strings and status codes preserved.
- Alias deprecation (no removals): `Deprecation`/`Sunset`/`Link` + counters on
  `POST /login`, `/client`, `/api/client`.
- Docs: `docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md` HTTP contracts section.
- Tests: `src/__tests__/httpContracts.test.ts`. Intake/`requestSubmission` left
  for PR 8.

### Completion summary (PR 8)

- Status remains `in_progress` (later slices + remaining P0 items still open).
  PR 8 marked complete.
- Baseline before PR 8: 44 suites / 362 tests. After PR 8: **45 suites / 369
  tests** (build + `npm test -- --runInBand --detectOpenHandles` +
  security-smoke; no open-handle report).
- Created `src/features/intake/` with domain
  (`normalizePublicIntakeSubmission` + DTO rules), application
  (`submitPublicRequestForm` + `IntakeLeadRepository` port), infrastructure
  (`LegacyRequestFormRepositoryAdapter`), http contract constants, and public
  `index.ts`.
- Legacy façade preserved: `POST /requestService/requestSubmission` →
  `RequestFormController.createForm` → `RequestFormService.newForm`.
- Domain normalize always on; default write still via repository through façade.
  `INTAKE_USE_FEATURE_PACKAGE=true` switches writes to use case.
  `INTAKE_SHADOW_COMPARE=true` logs use-case vs façade map parity (no PHI dump).
- Compatibility shim: `src/intake/requestSubmissionDto.ts` re-exports feature
  domain helpers.
- Success message constantized (`PUBLIC_INTAKE_SUCCESS_MESSAGE`) — string
  unchanged.
- Tests: `src/__tests__/intakeFeaturePackage.test.ts` (+ existing
  requestSubmission\* suites still pass).
- Next: later vertical slices (portal eligibility → …). Public intake abuse
  protection completed (see below).

### Completion summary (public intake abuse protection)

- Status remains `in_progress` (later slices / remaining epic ACs still open).
  P0 intake abuse item marked complete.
- `POST /requestService/requestSubmission`: honeypot (fake 200), IP + email rate
  limits (`429` + `RATE_LIMITED` + `Retry-After`), optional `Idempotency-Key`
  replay, soft email fingerprint dedupe (fake 200).
- Store: in-memory in test; Cloud SQL tables via
  `src/db/migrations/add_intake_rate_limits_and_idempotency.sql` in production.
- Jest: rate limits/soft-dedupe off unless `INTAKE_ABUSE_ENFORCE=true`
  (dedicated suite sets this).
- FE contract (updated 2026-08-14): success message unchanged; honeypot +
  `Idempotency-Key` + 429/`Retry-After` wired on public intake; test-data fill
  gated.
- Tests: `src/__tests__/intakeAbuseProtection.test.ts`; full suite +
  security-smoke green after wiring.
- Cloud SQL migration applied 2026-08-14 on `sokana_private`:
  `intake_rate_limits`, `intake_idempotency_keys`.
- **P0 security confirmed complete** on backend (PR 3–6 + intake abuse + CI/Jest
  gates) **and** frontend (role from `/auth/me`, route guards, `fetchWithAuth`,
  intake abuse client, 403 ≠ logout). Remaining epic work is P1/P2 structural
  (`Later slices`), not security. SPA is aligned with the API, not a vault.
  Production host is Cloud Run; Vercel headers do not apply.
- **Encryption (2026-08-14):** Cloud SQL Google-managed at rest; backups + PITR
  on; Cloud Run → SQL via connector unix socket; instance
  `sslMode: ENCRYPTED_ONLY`; `0.0.0.0/0` removed. This is HIPAA _input_, not a
  HIPAA attestation — next is BAA + risk analysis (see
  `docs/SECURITY_P0_HARDENING_SUMMARY.md`).

### Cloud Run safeguards (ongoing)

- [ ] Keep `sokana-private-api` as same deployable service.
- [ ] Never run migrations automatically at app boot.
- [ ] Additive forward-compatible migrations; deploy BE compatibility before FE.
- [ ] Retain previous Cloud Run revision for rollback.
- [ ] Do not change lightweight `/health` semantics unexpectedly.
- [ ] Avoid combining DB migration + auth transport + module refactor in one
      release.

## API/Contract Notes

- Endpoint(s):
  - Preserve existing public routes and aliases during P0–P2 rollout.
  - Priority hardening surfaces: `paymentRoutes`, `contractSigningRoutes`,
    `signNowRoutes`, SignNow/QB webhooks, auth token/cookie flows, public
    request submission.
- Request/response:
  - Preserve existing response fields and status codes while introducing stable
    error codes.
- Backward compatibility:
  - Dual-support auth transport before retiring JSON/query tokens.
  - Deprecation headers/telemetry before alias removal.

## Data/Migration Notes

- Tables: no immediate destructive schema changes.
- Required migration: only additive, forward-compatible changes when a vertical
  slice needs them.
- Fragmented migration history is a P1/P2 concern (ledger/checksums later).

## Acceptance Criteria

- [x] P0 security items completed or explicitly waived with documented
      public-endpoint inventory.
- [x] No localhost debug telemetry on production request paths.
- [x] Webhooks provider-authenticated with replay/idempotency protections.
- [x] Staff roles fail closed on authoritative server-managed source.
- [x] Backend test suite + security smoke required in deploy path.
- [x] Request intake routed through the new use-case structure behind the
      existing route/controller façade without behavior change unless a bug is
      explicitly identified and documented.
- [ ] Every milestone is delivered and verified independently; no PR combines
      database migration, auth transport migration, and structural refactoring.
- [ ] Status changes from `open` to `in_progress` only when PR 1 begins; use
      `ready_for_verification` for the active milestone; close this handoff only
      after the agreed P0 milestone and request intake slice are verified, with
      remaining P1/P2 work carried into follow-up handoffs.

## Verification Steps

- Backend:
  - `npm test` (expect 300+ passing; no open-handle flake)
  - Auth/role matrix tests for payment/signing/webhook/public endpoints
  - Cloud Run revision smoke before traffic shift; previous revision retained
- Frontend:
  - Coordinate with companion frontend handoff for auth transport + QB sync
    ownership changes
  - Deploy backend compatibility first, frontend second

## Implementation Notes

### Feature-first packaging standard

The first directory under `src/features` is always a recognizable Sokana
business capability. Infrastructure layers are nested inside their owning
feature; they are not top-level navigation categories.

- New business code starts in `src/features/<feature>`.
- Do not add new global `controllers`, `services`, `repositories`, or `routes`.
- Each `index.ts` exposes the feature's supported application/domain API.
- Cross-feature consumers use the public API and must not import another
  feature's infrastructure.
- Vendor names such as QuickBooks, SignNow, DocuSign, Stripe, and Supabase
  belong below the feature infrastructure that owns the workflow.
- `bootstrap` only assembles dependencies and starts the application; it
  contains no business rules.
- `shared` is restricted to domain-neutral config, HTTP, database, logging,
  security, and testing mechanisms.

Target layout (incremental, not big-bang):

```text
src/
  bootstrap/
  features/
    auth/{domain,application,http,infrastructure}
    intake/{domain,application,http,infrastructure}
    clients/{domain,application,http,infrastructure}
    doulas/{domain,application,http,infrastructure}
    matching/{domain,application,http,infrastructure}
    portal/{domain,application,http,infrastructure}
    contracts/{domain,application,http,infrastructure}
    billing/{domain,application,http,infrastructure}
    documents/{domain,application,http,infrastructure}
  shared/{config,database,http,logging,security,testing}
```

### Planned migration (not started)

This section is planning-only. Do not move source folders until the migration
slice is explicitly approved.

- [x] Add the feature-package rules in `src/features/README.md`.
- [x] Document request intake ownership and its target
      domain/application/HTTP/infrastructure boundaries without moving
      production code.
- [x] Move request intake validation and normalization rules under
      `src/features/intake/domain` while preserving the existing
      route/controller façade.
- [x] Move request intake application, HTTP, and persistence adapters only after
      characterization and parity tests pass.
- [ ] Replace temporary cross-feature infrastructure imports with application
      ports or public feature operations.
- [ ] Move portal eligibility under `src/features/portal` as the second
      structural slice.
- [ ] Move composition from the legacy root `src/index.ts` into `src/bootstrap`
      after the first feature slices are stable.

- Recurring sequence: Stabilize → capture behavior → extract pure rules → port →
  adapter → switch one endpoint/screen → monitor → remove old path later.
- Every PR: one use case/endpoint at a time; characterization tests first; no
  domain imports of Express/DB/SDK/env; no raw `process.env`/`console`/untyped
  expected errors in new code; never log tokens/PHI/unrestricted provider
  payloads.
- Safe now: tests/CI, telemetry removal, log redaction, endpoint auth (with
  inventory), webhooks/OAuth state, pure-rule extraction, DI/ports, strict TS
  per module.
- After pilot: alias removal, Supabase path retirement, migration consolidation,
  large renames, multi-service split (not recommended).
