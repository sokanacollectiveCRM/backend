# Frontend Context (Living Reference)

This file is intentionally updateable as frontend work finishes.

## Preflight Update 2026-08-31 (Nightly Playwright E2E stub alignment)

### Task

- Fix nightly Playwright failures by aligning E2E stubs with current canonical
  API shapes, cookie-mode auth, and UI copy.

### Files Scanned

- `frontend-crm/e2e/ticket3-client-status-interviewed.spec.ts`
- `frontend-crm/e2e/ticket4-notes-visibility-toggle.spec.ts`
- `frontend-crm/e2e/ticket5-doula-view-admin-notes.spec.ts`
- `frontend-crm/e2e/portal-eligibility-actions.spec.ts`
- `frontend-crm/e2e/portfolio/workflows/captureCrm.ts`
- `frontend-crm/e2e/clients-leads-customers-tabs.spec.ts`
- `frontend-crm/e2e/fixtures/httpStubs.ts`
- `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
- `frontend-crm/src/features/doula-dashboard/DoulaDashboardRoutes.tsx`
- `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/integrations/QuickBooksConnect.tsx`

### Contract Findings

- Client list/detail E2E stubs must use `{ success: true, data }` + snake_case
  against `http://localhost:5050/clients`.
- Cookie auth uses `GET /auth/me` (not `/api/auth/me`).
- Doula activities live at `/doula-dashboard/activities/:clientId` and call
  `/api/doulas/clients/:id/activities`; visibility toggle requires UUID ids.
- LeadProfileModal no longer exposes "Send $1 verification invoice";
  card-on-file status comes from `GET /api/payment-methods/:id`.
- QuickBooks page heading is `QuickBooks` (not "QuickBooks Integration").

### Drift Risk

- Nightly full Playwright suite fails when stubs still use legacy
  `{ clients: [] }` wrappers or removed UI affordances.

### Required Compatibility

- Keep canonical ApiResponse wrappers in E2E stubs.
- Prefer shared helpers in `e2e/helpers/e2eApiStubs.ts` and
  `e2e/helpers/doulaE2eStubs.ts`.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-08-31 (Signing credential session exchange)

### Task

- Remove invitation credentials from HTTP request URLs; exchange fragment
  credentials for short-lived signing sessions.

### Files Scanned

- `frontend-crm/src/features/public-signing/signingApi.ts`
- `frontend-crm/src/features/public-signing/PublicSigningPage.tsx`
- `frontend-crm/src/features/public-signing/PublicSigningEntry.tsx`
- `frontend-crm/src/features/public-signing/SigningPdf.tsx`
- `frontend-crm/src/Routes.tsx`
- `backend/src/features/contracts/routes/signingRoutes.ts`
- `backend/src/features/contracts/controllers/signingController.ts`

### Contract Findings

- Frontend previously called `/signing/:token` on the backend directly.
- PDF fallback URLs embedded invitation tokens in paths.
- Cross-origin frontend/backend requires header-based session transport, not
  cookies.

### Required Compatibility

- `POST /signing/session/exchange` body: `{ invitation: string }`
- Session ops: `GET /signing/session`, `/signing/session/document`,
  `POST /signing/session/progress`, `POST /signing/session/complete`
- Header: `X-Signing-Session` (or `Authorization: Signing <token>`)
- Email links: `{signingBaseUrl}#invitation=<credential>`
- Legacy backend token routes return 410 `LEGACY_SIGNING_ROUTE`

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-08-31 (CRM navigation + signed link redirect)

### Task

- Fix admin confusion: billing email link should land on signed contract page
  after login; sidebar should not point template editor; completed signing links
  should not reopen signing flow.

### Files Scanned

- `frontend-crm/src/common/data/sidebar-data.ts`
- `frontend-crm/src/common/components/routes/ProtectedRoutes.tsx`
- `frontend-crm/src/features/auth/Login.tsx`
- `frontend-crm/src/features/public-signing/PublicSigningPage.tsx`

### Contract Findings

- Sidebar **Contracts** linked to `/contracts` (template editor), not
  `/billing/contracts` (signed client contracts).
- Login always redirected to `/`, dropping deep links from admin email.
- Reopening a completed signing URL still loaded signing UI until manually
  leaving.

### Required Compatibility

- `PrivateRoute` preserves `?next=` for post-login redirect.
- Signed sessions redirect public signing page to `/contract-signed`.

## Preflight Update 2026-08-31 (Admin signed contract PDF in CRM)

### Task

- Let admin/billing staff open the signed contract PDF from the CRM billing
  contract page.

### Files Scanned

- `frontend-crm/src/features/billing-portal/BillingContractDetailPage.tsx`
- `frontend-crm/src/features/billing-portal/billingPortalApi.ts`
- `backend/src/routes/billingRoutes.ts`
- `backend/src/services/billingContractDownloadService.ts`
- `backend/src/features/contracts/services/contractService.ts`

### Contract Findings

- Admin signed notification email links to `/billing/contracts/:contractId`
  (payment schedule only).
- Backend already had `GET /api/contracts/:id/download` (admin-only, unwrapped
  JSON).
- Added `GET /api/billing/contracts/:contractId/download` returning ApiResponse
  `{ url, expiresInSeconds }` for admin + billing roles.

### Required Compatibility

- CRM button calls billing download endpoint and opens returned URL in a new
  tab.
- Button shown when `contractStatus === 'signed'` or `signedAt` is set.

## Preflight Update 2026-08-31 (Signature font + completion certificate)

### Task

- Align frontend typed-signature preview with backend PDF font (Great Vibes).
- Replace technical PDF evidence appendix with client-friendly completion
  certificate.

### Files Scanned

- `frontend-crm/src/features/public-signing/signingDisplay.ts`
- `frontend-crm/src/index.css`
- `frontend-crm/src/pages/ContractSignedPage.tsx`
- `frontend-crm/public/fonts/GreatVibes-Regular.ttf`
- `backend/src/features/contracts/pdf/renderer.ts`

### Contract Findings

- After FINISH, browser should navigate to `/contract-signed` (green success
  card), not stay on the PDF viewer.
- The last PDF page was a technical audit dump (`Contract Completion Evidence`
  with SHA-256 hashes) — not intended as the primary client web UX; audit data
  remains in GCS metadata and `contract_events`.
- PDF appendix now reads as a short **Certificate of Completion** for client
  records.

### Required Compatibility

- Self-hosted `/fonts/GreatVibes-Regular.ttf` matches backend embedded font.
- No API changes.

## Preflight Update 2026-08-31 (Typed signature PDF font)

### Task

- Typed signatures on completed PDFs should render in cursive/script, matching
  the signing UI preview.

### Files Scanned

- `frontend-crm/src/features/public-signing/signingDisplay.ts`
- `frontend-crm/src/features/public-signing/SigningPdf.tsx`
- `backend/src/features/contracts/pdf/renderer.ts`

### Contract Findings

- Frontend preview uses `TYPED_SIGNATURE_FONT` (Segoe Script / cursive stack).
- Backend previously stamped typed signatures with `HelveticaOblique`, which
  reads as plain italic text on the PDF.

### Required Compatibility

- No API change; typed signature payload unchanged (`{ type: 'typed', text }`).

## Preflight Update 2026-08-31 (Signing FINISH 500 fix)

### Task

- Fix `POST /signing/:token/complete` returning 500 when FINISH is pressed after
  all fields are completed.

### Files Scanned

- `frontend-crm/src/features/public-signing/PublicSigningPage.tsx`
- `frontend-crm/src/features/public-signing/signingApi.ts`
- `backend/src/features/contracts/pdf/renderer.ts`
- `backend/src/features/contracts/composition.ts`

### Contract Findings

- Frontend sends `completedFieldIds` with every applied manifest field
  (signature, initials, date).
- Backend PDF completion passed those ids through as `acknowledgedFieldIds`;
  renderer rejected non-acknowledgment ids and threw before persisting the
  signed PDF.

### Drift Risk

- Low after backend fix; frontend payload shape is correct and unchanged.

### Required Compatibility

- `completeSigning` body: `{ signature, consent, initials, completedFieldIds }`
  — all required manifest field ids in `completedFieldIds`.

## Preflight Update 2026-08-30 (Nancy temporary administrator password)

### Task

- Generate and set a temporary Identity Platform password for Nancy Cowans.

### Files Scanned

- `frontend-crm/src/common/contexts/UserContext.tsx`
- `frontend-crm/src/features/auth/Login.tsx`
- `frontend-crm/src/features/auth/ResetPassword.tsx`
- `backend/scripts/migrate-admin-auth-to-identity.ts`

### Contract Findings

- Administrator password authentication is handled by Google Identity Platform.
- Nancy must sign in through the existing login flow and can later replace the
  temporary password through the standard reset flow.

### Drift Risk

- Updating a Supabase credential would not affect the active Identity Platform
  administrator login.

### Required Compatibility

- Update only `nancy@sokanacollective.com` in project `sokana-private-data`.

### Action

- [x] Context updated
- [x] Implementation started
- [x] Password generated and set for Nancy's Identity Platform account

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-30 (post-reset login redirect)

### Task

- Ensure Nancy is redirected to login after successfully resetting her password.

### Files Scanned

- `frontend-crm/src/common/contexts/UserContext.tsx`
- `frontend-crm/src/features/auth/ResetPassword.tsx`
- `frontend-crm/src/features/auth/Login.tsx`

### Contract Findings

- Identity reset requests use `/login` as the Firebase post-reset continue URL.
- The custom reset form also calls `navigate('/login', { replace: true })` after
  a successful password update.

### Drift Risk

- Changing the Identity continue URL away from `/login` could return users to an
  already-consumed reset code.

### Required Compatibility

- Preserve `/login` as the successful post-reset destination.

### Action

- [x] Context updated
- [x] No implementation changes needed

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-30 (Nancy administrator reset resend)

### Task

- Send Nancy Cowans a fresh Google Identity Platform administrator
  password-reset email.

### Files Scanned

- `frontend-crm/src/common/contexts/UserContext.tsx`
- `frontend-crm/src/features/auth/Login.tsx`
- `frontend-crm/src/features/auth/ResetPassword.tsx`
- `backend/scripts/migrate-admin-auth-to-identity.ts`

### Contract Findings

- Identity reset links are single-use and expire.
- The frontend accepts Firebase `mode=resetPassword&oobCode=...` links and
  forwards links landing on `/login` to `/auth/reset-password`.
- Migration resends generate a fresh Identity Platform link with production
  `/auth/reset-password` as the continue URL and deliver it through Sokana
  email.

### Drift Risk

- Reusing a prior reset email produces the expired/already-used error.
- A localhost continue URL would make a valid production reset unusable.

### Required Compatibility

- Send only a newly generated link for `nancy@sokanacollective.com` and retain
  the production frontend continue URL.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-28 (Identity reset link oobCode redirect)

### Task

- Fix Teisha "Reset token not found" on Identity Platform admin password reset

### Files Scanned

- `frontend-crm/src/features/auth/Login.tsx`
- `frontend-crm/src/features/auth/ResetPassword.tsx`
- `backend/scripts/migrate-admin-auth-to-identity.ts`

### Contract Findings

- Migration reset emails used continueUrl `/login`; Firebase appends `oobCode`
  there.
- Reset page at `/auth/reset-password` reads `oobCode` from query params only.
- Login had no redirect → user could reach reset form without token.

### Drift Risk

- Existing migration emails still land on `/login?oobCode=...` until frontend
  deploy.

### Required Compatibility

- Login redirects `mode=resetPassword&oobCode` → `/auth/reset-password`.
- New migration/resend emails use continueUrl `/auth/reset-password`.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-08-26 (profile pictures → GCS)

### Task

- Switch profile picture storage to GCS `profile-pictures/` prefix; migrate
  existing Supabase images into per-user folders; verify with smoke/migration
  scripts.

### Files Scanned

- `frontend-crm/src/features/my-account/components/UpdateProfile.tsx`
- `frontend-crm/src/features/teams/teams.tsx`
- `backend/src/services/gcs/profilePictureStorage.ts`
- `backend/src/services/cloudSqlTeamService.ts`
- `backend/scripts/migrate-profile-pictures-to-gcs.ts`

### Contract Findings

- FE expects `profile_picture` to be a usable URL in API responses.
- Backend stores relative `{userId}/{file}` and resolves signed URLs on read;
  legacy http(s) URLs still pass through.

### Drift Risk

- Returning relative paths without resolve-on-read breaks avatars.

### Required Compatibility

- Keep `profile_picture` response field; sign GCS paths in team/auth payloads.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (doula documents → GCS)

### Task

- Switch doula document upload/download/delete/signed URLs from Supabase Storage
  to GCS `doula-documents/` prefix; verify with smoke test.

### Files Scanned

- `frontend-crm/src/features/doula-dashboard/components/DocumentsTab.tsx`
- `frontend-crm/src/api/doulas/doulaService.ts`
- `backend/src/services/doulaDocumentUploadService.ts`
- `backend/src/repositories/doulaDocumentRepository.ts`

### Contract Findings

- DocumentsTab uses backend upload/list/delete/update APIs; storage backend is
  opaque if paths/signed URLs stay API-mediated.
- Keep relative `filePath` shape used today so Cloud SQL metadata stays
  compatible.

### Drift Risk

- Changing path format without prefix resolution breaks open/download for
  existing rows.

### Required Compatibility

- Preserve document types, size/MIME checks, and response shapes; only storage
  backend changes.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (client documents → GCS)

### Task

- Switch client document upload/download/delete/signed URLs from Supabase
  Storage to GCS `client-documents/` prefix; verify with a test upload.

### Files Scanned

- `frontend-crm/src/api/clients/clientDocuments.ts`
- `frontend-crm/src/features/client-dashboard/components/ClientProfileTab.tsx`
- `backend/src/services/clientDocumentUploadService.ts`
- `backend/src/repositories/clientDocumentRepository.ts`
- `backend/src/constants/clientDocuments.ts`

### Contract Findings

- FE uses backend APIs for upload/list/delete/signed URL; does not talk to
  Supabase Storage directly for client docs.
- Response shape stays
  `{ id, clientId, documentType, fileName, filePath, ... }` + signed URL from
  download endpoint.

### Drift Risk

- Changing `filePath` format without resolving via GCS prefix breaks existing
  Cloud SQL rows and FE open/download.
- Keep relative path `{clientId}/{documentType}/{timestamp}_{file}`; resolve
  with `client-documents/` prefix in GCS.

### Required Compatibility

- Preserve upload validation (MIME, size) and API routes; only storage backend
  changes.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (contract templates live in GCS)

### Task

- Cut over contract template storage to GCS; FE preview via signed-url/download
  instead of public Supabase URL.

### Files Scanned

- `frontend-crm/src/features/contracts/components/pdf/PdfPreview.tsx`
- `frontend-crm/src/common/hooks/contracts/useTemplates.ts`
- `backend/src/services/supabaseContractService.ts`
- `backend/src/routes/contractTemplateRoutes.ts`

### Contract Findings

- Templates list still `GET /contracts/templates` →
  `{ id, name, depositFee, serviceFee, storagePath }[]`.
- Preview no longer uses `VITE_SUPABASE_URL` public storage; uses `/signed-url`
  then `/download` blob fallback.

### Drift Risk

- Deploying BE without FE (or vice versa) breaks template preview until both
  ship.
- Local ADC cannot mint V4 signed URLs; download fallback required.

### Required Compatibility

- Keep template filenames unchanged.
- Keep list/upload/delete routes; add signed-url + download under admin auth.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (upload contract templates to GCS)

### Task

- Upload known contract DOCX templates into GCS `contract-templates/` prefix
  (bytes only; app still reads Supabase until cutover).

### Files Scanned

- `backend/templates/Agreement for Postpartum Doula Services.docx`
- `backend/templates/Labor Support Agreement for Service.docx`
- `backend/src/services/supabaseContractService.ts`
- `docs/GCS_DOCUMENT_STORAGE.md`

### Contract Findings

- FE contracts UI lists templates via backend; storage path is opaque if
  list/download stay API-mediated.
- Known filenames must remain identical for Labor Support / Postpartum
  detection.

### Drift Risk

- Renaming files in GCS without updating `KNOWN_STORAGE_TEMPLATES` /
  contractProcessor breaks generation.

### Required Compatibility

- Keep filenames: `Agreement for Postpartum Doula Services.docx`,
  `Labor Support Agreement for Service.docx`.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (GCS one-bucket + prefixes decision)

### Task

- Lock WS-3 storage layout: single private bucket `sokana-private-documents`
  with type prefixes (not separate buckets).

### Files Scanned

- `frontend-crm/src/features/doula-dashboard/components/DocumentsTab.tsx`
- `docs/SUPABASE_FULL_EXIT_LAUNCH_PLAN.md`

### Contract Findings

- FE still uses backend document APIs; bucket/prefix layout is opaque until
  upload services cut over.

### Drift Risk

- None for FE from infra layout decision alone.

### Required Compatibility

- Keep Supabase-backed document APIs until code cutover; prefixes are prep only.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (create GCS document buckets)

### Task

- Provision private GCS buckets for WS-3 Supabase Storage → GCS (infra only; no
  API cutover yet).

### Files Scanned

- `frontend-crm/src/features/doula-dashboard/components/DocumentsTab.tsx`
- `backend/src/services/clientDocumentUploadService.ts`
- `backend/src/services/doulaDocumentUploadService.ts`
- `docs/SUPABASE_FULL_EXIT_LAUNCH_PLAN.md`
- `.cursor/handoffs/open/2026-08-25-full-supabase-exit-launch-ready.md`

### Contract Findings

- DocumentsTab uses backend upload/list/delete APIs; does not reference Supabase
  bucket names.
- Bucket creation alone does not change FE contracts.

### Drift Risk

- None for FE until upload services switch to GCS signed URLs.

### Required Compatibility

- Keep current Supabase-backed document APIs until code cutover; buckets are
  prep only.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (GCS doc storage explanation)

### Task

- Explain how Supabase Storage → private GCS document transfer works
  (informational; no code).

### Files Scanned

- `.cursor/handoffs/open/2026-08-25-full-supabase-exit-launch-ready.md`
- `docs/SUPABASE_FULL_EXIT_LAUNCH_PLAN.md`
- `docs/SUPABASE_DATABASE_USAGE_INVENTORY.md`
- `src/services/clientDocumentUploadService.ts`
- `src/services/doulaDocumentUploadService.ts`

### Contract Findings

- Frontend still expects signed URLs / document metadata from backend; storage
  backend is opaque if upload/download stay API-mediated.
- No FE contract change required for an explanation-only answer.

### Drift Risk

- Switching storage without keeping signed-URL and metadata shapes breaks
  DocumentsTab / insurance uploads / contracts.

### Required Compatibility

- Keep backend-issued signed URLs; metadata in Cloud SQL; no direct
  browser→bucket writes.

### Action

- [x] Context updated (no code)
- [ ] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (admin-only Supabase Auth migration)

### Task

- Migrate Cloud SQL admins from Supabase Auth to GCP Identity Platform and
  require password reset; do not migrate doulas or clients in this phase.

### Files Scanned

- `frontend-crm/src/common/contexts/UserContext.tsx`
- `frontend-crm/src/features/auth/Login.tsx`
- `backend/scripts/seed_admins_from_supabase.ts`
- `backend/src/security/resolveAuthoritativeRole.ts`
- `backend/src/services/identityPlatform/loadUserFromIdentity.ts`
- `backend/src/services/cloudSqlTeamService.ts`

### Contract Findings

- Frontend `VITE_AUTH_MODE=identity` uses Identity Platform password auth,
  backend email OTP, and existing Bearer/cookie session transport.
- Cloud SQL `public.admins` is authoritative for admin role; Identity Platform
  UIDs may differ from Cloud SQL UUIDs, so role/profile resolution must match
  normalized email and return the Cloud SQL UUID downstream.
- Client portal remains on its existing Supabase-specific flow; no client or
  doula accounts are mutated in this migration.

### Drift Risk

- Treating Identity Platform UID as a Cloud SQL UUID breaks role lookup.
- Removing Supabase verification before every admin completes reset would lock
  out unmigrated users; keep backend `AUTH_PROVIDER=dual` during rollout.

### Required Compatibility

- Create/update Identity Platform accounts only for emails present in Cloud SQL
  `public.admins`.
- Verify each admin email exists in the Supabase Auth source inventory, retain
  Cloud SQL role/profile data, and send an Identity Platform reset link.
- Migration must be idempotent, dry-run by default, and report counts without
  printing secrets.

### Action

- [x] Context updated
- [x] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (Identity Platform email/password + email OTP)

### Task

- Implement staff CRM auth via GCP Identity Platform (email/password) with
  app-level email OTP 2FA; no Google Sign-In provider.

### Files Scanned

- `frontend-crm/src/api/config.ts`
- `frontend-crm/src/api/http.ts`
- `frontend-crm/src/common/contexts/UserContext.tsx`
- `frontend-crm/src/features/auth/Login.tsx`
- `frontend-crm/src/features/auth/GoogleButton.jsx`
- `backend/src/middleware/authMiddleware.ts`
- `backend/src/controllers/authController.ts`
- `backend/src/routes/authRoutes.ts`
- `backend/src/services/supabaseAuthService.ts`
- `backend/src/security/resolveAuthoritativeRole.ts`

### Contract Findings

- Today: `VITE_AUTH_MODE=cookie|supabase`; session via cookie / Bearer /
  `X-Session-Token`; `/auth/me` is authoritative for role/user.
- Target identity mode: FE signs in with Firebase Web SDK → `POST /auth/session`
  (idToken) → email OTP → `POST /auth/mfa/verify` → same session transport as
  today (IdP idToken as session token).

### Drift Risk

- Middleware must dual-verify Supabase + Identity Platform JWTs during cutover.
- Frontend must not set full session until MFA verify succeeds.

### Required Compatibility

- Keep Bearer + `X-Session-Token` + cookie after MFA.
- Login success shape: `{ message, user, token }` after MFA verify.
- `POST /auth/session` returns `{ mfaRequired: true, challengeId, emailHint }`
  (no session cookie yet).

### Action

- [x] Context updated
- [ ] Implementation started

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-26 (auth/login Google Identity exploration)

### Task

- Explore frontend-crm authentication/login for Google Identity migration
  planning (read-only; no code changes).

### Files Scanned

- `frontend-crm/src/main.tsx`
- `frontend-crm/src/App.tsx`
- `frontend-crm/src/Routes.tsx`
- `frontend-crm/src/lib/supabase.ts`
- `frontend-crm/src/api/config.ts`
- `frontend-crm/src/api/http.ts`
- `frontend-crm/src/api/sessionAccessToken.ts`
- `frontend-crm/src/api/authToken.ts`
- `frontend-crm/src/common/contexts/UserContext.tsx`
- `frontend-crm/src/common/components/routes/ProtectedRoutes.tsx`
- `frontend-crm/src/features/auth/Login.tsx`
- `frontend-crm/src/features/auth/ClientLogin.tsx`
- `frontend-crm/src/features/auth/AuthCallback.tsx`
- `frontend-crm/src/features/auth/GoogleButton.jsx`
- `frontend-crm/src/features/auth/AuthRoutes.tsx`
- `frontend-crm/src/common/hooks/auth/useClientAuth.ts`

### Contract Findings

- Dual auth mode via `VITE_AUTH_MODE`: default `cookie` → `POST /auth/login` +
  cookies; `supabase` → `signInWithPassword` then Bearer.
- Google today: Supabase `signInWithOAuth({ provider: 'google' })` or backend
  `GET /auth/google` → `/auth/callback` hash token → `POST /auth/callback`.
- No Firebase Auth / Identity Platform / GIS SDK in frontend.
- No magic-link login UI; client portal is email/password only.
- API auth transport: `sessionStorage` token + `Authorization: Bearer` +
  `X-Session-Token`; cookie mode also `credentials: include`.

### Drift Risk

- Replacing Google/Supabase auth without updating `UserContext.googleAuth`,
  `AuthCallback`, and `getRequestAuth()` will break staff login and API calls.

### Required Compatibility

- Keep Bearer + `X-Session-Token` (and/or cookie) contract until backend
  Identity Platform verification is ready; frontend must mint/store the new
  session token the same way.

### Action

- [x] Context updated
- [x] Exploration report delivered (no implementation)

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`

## Preflight Update 2026-08-25 (launch boundary auth/data residency assessment)

### Task

- Assess staff-only pilot vs client-facing launch against Supabase-auth / Cloud
  SQL residency boundary (read-only; no code changes).

### Files Scanned

- `frontend-crm/src/lib/supabase.ts`
- `frontend-crm/src/features/auth/ClientLogin.tsx`
- `frontend-crm/src/features/auth/SetPassword.tsx`
- `frontend-crm/src/features/auth/SignUp.tsx`
- `frontend-crm/src/common/hooks/auth/useClientAuth.ts`
- `frontend-crm/src/common/components/routes/ProtectedRoutes.tsx`
- `frontend-crm/src/Routes.tsx`
- `backend/src/services/portalInviteService.ts`
- `backend/src/services/supabaseAuthService.ts`
- `backend/src/security/resolveAuthoritativeRole.ts`
- `backend/src/middleware/authMiddleware.ts`
- `backend/src/index.ts`
- `docs/SUPABASE_DATABASE_USAGE_INVENTORY.md`
- `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`

### Contract Findings

- Client portal auth is live in FE: `/auth/set-password`, `/auth/client-login`
  call Supabase Auth directly; staff CRM uses `/auth/login` + `/auth/me`.
- Portal invite BE creates Supabase Auth users with
  `user_metadata.role: 'client'` and recovery links to set-password.
- Staff roles resolved from Cloud SQL (`admins`/`doulas`); client role from
  `phi_clients.user_id` linkage.

### Drift Risk

- Assessment-only; no API contract changes.

### Required Compatibility

- No changes needed for this pass.

### Action

- [x] Context updated
- [x] Assessment delivered (no implementation)

### Handoff inbox

- `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (user explicitly
  requested this assessment; not implementing that handoff here)

## Preflight Update 2026-08-25 (HIPAA-13B doula client read assignment gates)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Block unassigned doulas from reading client/family records
  via CRM client routes; return safe 404/403 without existence leak (HIPAA-13B /
  INV-03 / INV-13).
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred; user
  prioritized HIPAA-13B)
- **Files Scanned**:
  - `frontend-crm/src/features/doula-dashboard/components/ClientsTab.tsx`
  - `frontend-crm/src/api/doulas/doulaService.ts`
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `backend/src/controllers/clientController.ts`
  - `backend/src/routes/clientRoutes.ts`
- **Contract Findings**:
  - Doula dashboard uses `/api/doulas/clients` and
    `/api/doulas/clients/:clientId` (already assignment-scoped); unassigned read
    now returns 404 instead of 403 — frontend should treat as “not found”.
  - Admin CRM uses `GET /clients/:id`; unassigned doula must not call this path
    (route allows doula but now enforces assignment).
  - No response-shape change for authorized callers (`ApiResponse.success` /
    `{ success, data }` unchanged).
- **Drift Risk**: Low — only deny paths change for unauthorized doula; assigned
  doula and admin payloads unchanged.
- **Required Compatibility**: Frontend 404 handling on client detail fetch
  already present (quiet redirect in admin list deep-link flow).
- **Action**:
  - [x] Context updated
  - [x] Implementation complete
  - [ ] Production deploy verification pending

## Preflight Update 2026-08-25 (HIPAA-05 doula assignment email minimization)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Remove PHI from doula-assignment emails; notify with
  client_number + authenticated CRM activities deep-link only (HIPAA-05).
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred; user
  prioritized HIPAA-05)
- **Files Scanned**:
  - `frontend-crm/src/features/doula-dashboard/DoulaDashboardRoutes.tsx`
  - `frontend-crm/src/features/doula-dashboard/DoulaDashboardSidebar.tsx`
  - `frontend-crm/src/common/data/sidebar-data.ts`
  - `backend/src/services/emailService.ts` (`sendDoulaMatchNotification`)
  - `backend/src/controllers/adminController.ts` (`matchDoulaWithClient`)
- **Contract Findings**:
  - Doula assignment CRM deep-link: `/doula-dashboard/activities/{clientId}`
    (protected doula route).
  - Old email used wrong path `/doula/dashboard`; corrected to activities
    deep-link matching frontend routing.
  - No frontend changes required for this backend email minimization.
- **Status**: [x] Context updated · [x] Implementation complete · [x] Production
  deploy `00044-bhf`

## Preflight Update 2026-08-24 (deep-link not-found quiet UX)

- **Gate Result**: `run_preflight`
- **Task Intent**: Email CRM deep-link to missing client must not show list
  banner ("Error loading clients") or "Client Not Found" modal.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred)
- **Files Scanned**:
  - `frontend-crm/src/features/clients/Clients.tsx`
  - `frontend-crm/src/common/hooks/clients/useClients.ts`
  - `frontend-crm/src/features/clients/components/users-dialogs.tsx`
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
- **Contract Findings**:
  - Deep-link `/admin/clients/:clientId` opens lead modal via
    `RouteAwareLeadProfileLoader` + `getClientById`.
  - `getClientById` previously wrote 404 into shared `error`, which rendered the
    list banner while the missing-client modal also opened.
- **Action**: Quiet redirect to `/admin/clients` (or `/clients`) on miss; detail
  404 does not set list `error`.
- **Status**: [x] Context updated · [x] Implementation complete

## Preflight Update 2026-08-24 (HIPAA-13F intake email minimization)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Remove clinical/identity payload from public intake staff
  emails; notify with client_number + authenticated CRM link only (INV-01).
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred; user
  prioritized HIPAA-13F)
- **Files Scanned**:
  - `frontend-crm/src/features/request/RequestForm.tsx`
  - `frontend-crm/src/features/request/RequestFormDesktop.tsx`
  - `frontend-crm/src/features/request/contexts/RequestFormContext.tsx`
  - `frontend-crm/src/features/clients/ClientRoutes.tsx`
  - `frontend-crm/src/Routes.tsx`
  - `backend/src/controllers/requestFormController.ts`
  - `backend/src/features/intake/notifications/intakeStaffNotificationEmail.ts`
- **Contract Findings**:
  - Public intake posts to `/requestService/requestSubmission`; success message
    contract unchanged (`PUBLIC_INTAKE_SUCCESS_MESSAGE`).
  - Frontend does not parse staff email content; CRM deep-link
    `/admin/clients/:clientId` (and `/clients/:clientId`) already supported.
  - No frontend API response-shape change required for this ticket.
- **Drift Risk**: Low — email is backend-only; frontend continues to open leads
  via authenticated CRM routes.
- **Required Compatibility**: Keep public intake 200 body
  `{ message: PUBLIC_INTAKE_SUCCESS_MESSAGE }`; CRM client routes remain
  staff-auth gated.
- **Action**:
  - [x] Context updated
  - [x] Implementation complete

## Preflight Update 2026-08-23 (remove legacy birth_outcomes narrative)

- **Gate Result**: `run_preflight`
- **Task Intent**: Drop free-text `birth_outcomes`; CRM saves via
  `PUT /clients/:id/birth-outcomes` only (structured dropdowns/checkboxes).
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred)
- **Files Scanned**:
  - `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/api/services/clients.service.ts`
  - `frontend-crm/src/api/doulas/doulaService.ts`
  - `backend/src/controllers/clientController.ts`
  - `backend/src/constants/phiFields.ts`
- **Contract Findings**:
  - Generic `PUT /clients/:id` now returns 400 for any birth-outcomes keys.
  - Dedicated route returns
    `{ success, data: { birth_outcomes_induction, ... } }`.
  - Legacy narrative column no longer exposed in client detail DTO/API.
- **Action**: [x] Context updated · [x] Implementation complete

## Preflight Update 2026-08-23 (INV-12 birth-outcomes assignment)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Enforce `canAccessSensitive` on
  `PUT /clients/:id/birth-outcomes`.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred; user
  prioritized INV-12)
- **Files Scanned**:
  - `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/common/utils/updateClient.ts`
  - `frontend-crm/src/config/clientFieldRouting.ts`
  - `frontend-crm/src/api/doulas/doulaService.ts`
  - `backend/src/controllers/clientController.ts`
  - `backend/src/routes/clientRoutes.ts`
- **Contract Findings**:
  - Doula dashboard and Lead Profile save structured birth outcomes via
    `updateClient` → `PUT /clients/:id` (generic), not
    `PUT /clients/:id/birth-outcomes`.
  - Dedicated birth-outcomes endpoint expects snake_case structured fields;
    frontend already uses those keys in save payloads.
  - Denied access should surface as non-2xx; frontend shows toast via
    `result.success` / HTTP error — no change required for 403.
- **Drift Risk**: Generic `PUT /clients/:id` may still accept birth-outcome
  fields without assignment check until separately gated.
- **Required Compatibility**: Keep 200 success shape
  `{ success: true, data: { birth_outcomes_induction, ... } }` on dedicated
  route; 403 body `{ success: false, error, code: 'FORBIDDEN' }`.
- **Action**:
  - [x] Context updated
  - [x] Implementation complete

## Preflight Update 2026-08-23 (payment-schedule migration)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Apply Cloud SQL migration adding `paid_at` to fix
  payment-schedule 500.
- **Repos Scanned**: backend only
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (deferred)
- **Files Scanned**:
  - `src/db/migrations/20260717_complete_payment_schedules_cloudsql.sql`
  - `scripts/run-cloudsql-migration.ts`
  - `src/services/installmentInvoiceService.ts`
- **Contract Findings**: DB schema drift caused
  `/clients/:id/billing/payment-schedule` 500.
- **Drift Risk**: Local Cloud SQL must stay aligned with service SQL
  expectations.
- **Action**:
  - [x] Context updated
  - [x] Migration applied locally

## Preflight Update 2026-08-23 (LeadProfileModal DialogDescription)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Add Radix `DialogDescription` to Lead Profile modal (Leads
  tab).
- **Repos Scanned**: frontend only
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (non-HIPAA; deferred)
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/common/components/ui/dialog.tsx`
- **Contract Findings**: UI-only a11y fix. No API contract change.
- **Drift Risk**: None.
- **Required Compatibility**: N/A
- **Manual verification (2026-08-23)**: User opened lead profile from Leads tab;
  no PHI in browser console logs (HIPAA-07 spot-check).
- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Entry Checklist

Use this checklist at the top of every new preflight entry:

- **Gate Result**: `run_preflight` or `skip_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: one line
- **Repos Scanned**: backend/frontend/both
- **Files Scanned**: list of concrete paths
- **Context Updated**: yes/no
- **Implementation Started After Gate**: yes/no

## Preflight Update 2026-08-22 (HIPAA-07 frontend sensitive logging)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Remove PHI/token/body console logging from CRM SPA; add CI
  gate.
- **Repos Scanned**: both (frontend primary; backend docs/handoff only)
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-22-hipaa-07-frontend-sensitive-logging.md`
- **Files Scanned**:
  - `frontend-crm/src/common/utils/updateClient.ts`
  - `frontend-crm/src/common/utils/deleteClient.ts`
  - `frontend-crm/src/common/utils/createContract.ts`
  - `frontend-crm/src/features/clients/Clients.tsx`
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/api/doulas/doulaService.ts`
  - Full `src/` for `console.log` / `console.debug`
- **Contract Findings**: No API contract change. Logging only. Production uses
  `logger` no-ops + `safeLog` metadata (`scope`, `operation`, `status`).
- **Drift Risk**: Reintroducing `console.log` of payloads would re-expose PHI in
  browser DevTools; CI `check:sensitive-logging` blocks regression.
- **Required Compatibility**: Keep toast/user-visible errors; never log response
  bodies. Export/download flows must not console-log CSV/JSON payloads.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-30 (Contract Billing to Portal Workflow)

- **Gate Result**: `run_preflight`
- **Task Intent**: Make client invoicing respect insurance/self-pay/no-payment
  billing paths and document contract-to-portal account creation end to end.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`,
  `2026-08-25-full-supabase-exit-launch-ready.md`; the user explicitly
  prioritized contract billing and onboarding.
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/dialog/EnhancedContractDialog.tsx`
  - `frontend-crm/src/common/utils/createContract.ts`
  - `backend/src/routes/contractSigningRoutes.ts`
  - `backend/src/features/contracts/services/contractService.ts`
  - `backend/src/services/contractSignatureCompletionService.ts`
  - `backend/src/services/portalEligibilityService.ts`
  - `backend/src/constants/portalEligibility.ts`
  - `backend/src/services/portalInviteService.ts`
- **Contract Findings**: Contract creation now sends the selected client ID and
  resolves it authoritatively in Cloud SQL, with email lookup retained for
  legacy callers. Billing path is stored on `phi_clients.payment_method`; the
  current completion path does not explicitly gate QuickBooks invoices by that
  path, and portal blockers currently require a deposit for every billing path.
- **Drift Risk**: Trusting a browser payment flag or treating insurance,
  Medicaid, full-support, and no-payment clients as self-pay can generate an
  incorrect client invoice and block portal invitation.
- **Required Compatibility**: Derive billing path from Cloud SQL, create client
  deposit invoices only for self-pay, treat no-payment labels as full-support,
  preserve insurance card-on-file rules, and keep portal account creation behind
  authoritative eligibility.
- **Action**: Context updated; implement fail-closed invoice guards, scenario
  tests, and an end-to-end workflow document.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-30 (Labor Initial Placement)

- **Gate Result**: `run_preflight`
- **Task Intent**: Align labor-contract initials immediately after each rendered
  financial amount.
- **Files Scanned**:
  - `backend/scripts/seed-native-contract-templates.ts`
  - `backend/src/features/contracts/pdf/coordinates.ts`
  - `frontend-crm/src/features/public-signing/SigningPdf.tsx`
  - `frontend-crm/src/features/public-signing/signingFields.ts`
- **Contract Findings**: The frontend maps normalized top-left manifest
  coordinates directly and accurately. The current labor manifest uses
  placeholder-width x positions, leaving initial boxes displaced from the much
  shorter rendered dollar values.
- **Drift Risk**: Frontend offsets would break other templates and signed PDF
  output. Mutating an existing template version would also invalidate frozen
  contract assumptions.
- **Required Compatibility**: Publish a new labor template version with smaller
  boxes directly after the three rendered amounts and restore the closer date
  position; retain prior versions for existing contracts.
- **Action**: Context updated; add and verify final labor template v4 after
  visual feedback on v3.
- **Frontend UX Follow-up**: Initial fields are tightly grouped on the financial
  lines, so rendering a floating label for every incomplete initial creates
  overlapping, repetitive banners. Suppress visual initial banners while
  preserving the yellow boxes, guided scrolling, titles, and ARIA labels.
- **Modal/Exit Follow-up**: The adoption dialog currently blocks outside clicks
  and Escape without an open-state callback, which also leaves its close button
  ineffective. Allow normal dialog dismissal and register a native
  `beforeunload` warning while an unsigned, continuable session is open.
- **Signed Copy Follow-up**: Completed PDFs remain private in GCS and the signer
  receives an attached copy through the post-signing outbox. Add a private
  internal BCC for `hello@sokanacollective.com`; the frontend download remains
  backed by short-lived protected document access.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-30 (Local Native Signing Connectivity)

- **Gate Result**: `run_preflight`
- **Task Intent**: Restore the emailed public signing page after a local API
  connection refusal.
- **Files Scanned**:
  - `frontend-crm/src/features/public-signing/signingApi.ts`
  - `frontend-crm/src/features/public-signing/PublicSigningPage.tsx`
  - `frontend-crm/src/api/http.ts`
- **Contract Findings**: Public signing requests use the shared API base URL;
  the running frontend is resolving that URL to `http://localhost:5050`.
- **Drift Risk**: Running the backend on port 8080 while the frontend targets
  port 5050 makes every invitation appear unavailable before token validation.
- **Required Compatibility**: Keep this local backend on port 5050 for the
  current frontend session; preserve unauthenticated token-based requests.
- **Action**: Context updated; restart the backend on port 5050 and verify the
  public signing endpoint is reachable.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-30 (Native signing invitation resend)

- **Gate Result**: `run_preflight`
- **Task Intent**: Revoke the prior test invitation and email a fresh native
  signing link to the existing test contract recipient.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; the user explicitly
  prioritized this resend.
- **Files Scanned**:
  - `frontend-crm/src/features/public-signing/signingApi.ts`
  - `frontend-crm/src/features/public-signing/PublicSigningPage.tsx`
  - `backend/src/features/contracts/services/contractService.ts`
  - `backend/src/features/contracts/controllers/contractController.ts`
- **Contract Findings**: The frontend reads the bearer token from the
  `/signing/:token` route and calls public signing APIs without auth cookies.
  Backend resend accepts only active contracts, atomically revokes prior
  invitations, and emails the newly generated token.
- **Drift Risk**: Reusing or exposing an old bearer token would bypass the
  intended revocation model.
- **Required Compatibility**: Preserve the localhost frontend signing base URL
  and use the native resend operation so only the newest emailed link remains
  valid.
- **Action**: Context updated; no implementation change needed.

## Preflight Update 2026-08-29 (Native Contract Signing UI)

- **Gate Result**: `run_preflight`
- **Task Intent**: Add the public frontend route needed to open emailed native
  contract invitations and complete signing without the CRM creation workflow.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; the user explicitly
  prioritized the native signing test.
- **Files Scanned**:
  - `frontend-crm/src/Routes.tsx`
  - `frontend-crm/src/pages/ContractSignedPage.tsx`
  - `frontend-crm/src/common/utils/createContract.ts`
  - `backend/src/features/contracts/routes/signingRoutes.ts`
  - `backend/src/features/contracts/controllers/signingController.ts`
  - `backend/src/features/contracts/validation/schemas.ts`
- **Contract Findings**: The frontend has no `/signing/:token` route. The public
  backend returns a PDF URL, ordered signing manifest, progress, consent,
  expiry, and `canContinue`; progress and completion accept field IDs while
  contract identity, signer identity, coordinates, and timestamps remain
  server-authoritative.
- **Drift Risk**: A frontend that invents field coordinates or required IDs,
  logs the URL token, sends client timestamps, or uses authenticated API helpers
  for the public route would weaken the backend security model or break signing.
- **Required Compatibility**: Use `/signing/:token`, render backend-provided
  normalized coordinates in order, submit only completed field IDs, initials,
  consent, and typed/drawn signature, avoid token logging/storage, and navigate
  to `/contract-signed?contract_id=...` after success.
- **Action**: Context updated; implement and verify the public signing page in
  the frontend repository.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-20 (QB-authoritative card on file)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Card-on-file status must check linked QuickBooks customer
  cards only.
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/api/services/clients.service.ts`
  - `backend/src/services/payments/customerPaymentMethodService.ts`
- **Contract Findings**: `GET /api/payment-methods/:clientId` now returns
  `message` and treats QuickBooks customer cards as sole on-file authority (no
  local fallback for staff messaging). FE displays `message` directly.
- **Drift Risk**: Older FE without `message` still has on_file/status fallbacks.
- **Required Compatibility**: Keep `{ success, data }` wrapper; include
  `message`, `on_file`, `source`.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-20 (Payment Schedule HTML 404)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix production Payment Schedule red HTML from missing
  `/api/payment-methods/:clientId`.
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/api/services/clients.service.ts`
  - `frontend-crm/src/api/http.ts`
  - `backend/src/server.ts`
  - `backend/src/routes/paymentMethodRoutes.ts`
- **Contract Findings**: FE calls `GET /api/payment-methods/:clientId` +
  `GET /clients/:id/billing/payment-schedule` via `Promise.all`. Route existed
  in code but was gated behind `FEATURE_QUICKBOOKS`; prod docs set that flag
  false → Express HTML 404. FE rendered raw HTML as `billingError`.
- **Drift Risk**: Card-on-file path must stay mounted even when QB OAuth is off.
- **Required Compatibility**: Always mount `/api/payment-methods`; keep
  `{ success, data }` wrapper for card status.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-20 (HIPAA-13A full-field CSV export)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Expand admin client CSV export to all `phi_clients` columns.
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/users-primary-buttons.tsx`
  - `backend/src/repositories/cloudSqlClientRepository.ts`
  - `backend/docs/HIPAA_13A_CLIENT_CSV_EXPORT_STATUS.md`
- **Contract Findings**: Path/auth unchanged (`GET /clients/fetchCSV`,
  admin-only). CSV body expands from 4 columns to all `phi_clients` columns
  (~88). FE still downloads `demographics.csv` as text/csv — no FE parse of
  columns.
- **Drift Risk**: Larger PHI payload on admin export; FE must not log response
  body.
- **Required Compatibility**: Keep text/csv download UX for admin Export button.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-20 (HIPAA-13A admin-only CSV export)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Restrict bulk client CSV export to admin; document exported
  fields for stakeholders.
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/users-primary-buttons.tsx`
  - `backend/src/routes/clientRoutes.ts`
  - `backend/src/usecase/clientUseCase.ts`
  - `backend/src/middleware/authorizeRoles.ts`
  - `backend/src/repositories/cloudSqlClientRepository.ts`
- **Contract Findings**: Path unchanged (`GET /clients/fetchCSV`). CSV body
  unchanged (`first_name,last_name,annual_income,address_line1` all rows). Role
  allowlist now admin-only (was admin+client). FE Export button gated to
  `user.role === 'admin'`.
- **Drift Risk**: Non-admin callers that previously succeeded now get 403;
  doulas on Clients page no longer see Export.
- **Required Compatibility**: Keep `/clients/fetchCSV` + text/csv download for
  admin.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-20 (HIPAA-13A CSV export existence check)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Confirm whether bulk client CSV export exists as a CRM
  feature (HIPAA-13A / INV-02).
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/users-primary-buttons.tsx`
  - `backend/src/routes/clientRoutes.ts`
  - `backend/src/usecase/clientUseCase.ts`
  - `backend/src/repositories/cloudSqlClientRepository.ts`
- **Contract Findings**: Feature exists end-to-end. FE Clients toolbar calls
  `GET /clients/fetchCSV` and downloads `clients.csv`. BE allows roles `admin`
  and `client`; use case re-checks same; repo
  `SELECT first_name, last_name, annual_income, address_line1 FROM phi_clients`
  with no row filter.
- **Drift Risk**: Tightening BE roles to admin-only will break CSV button for
  any non-admin caller that currently succeeds; FE should stay admin-gated or
  show clear 403.
- **Required Compatibility**: Keep path `/clients/fetchCSV` and CSV download UX
  for admin.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (existence question only)

## Preflight Update 2026-08-20 (HIPAA board technical re-verify)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Re-verify HIPAA board items against current frontend/backend
  code; update technical status list (no implementation).
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/common/utils/updateClient.ts`
  - `frontend-crm/src/common/utils/deleteClient.ts`
  - `frontend-crm/src/common/hooks/auth/useIdleTimeout.ts`
  - `frontend-crm/src/features/clients/Clients.tsx`
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/api/doulas/doulaService.ts`
  - `backend/src/routes/clientRoutes.ts`
  - `backend/src/routes/specificUserRoutes.ts`
  - `backend/src/controllers/clientController.ts` (`updateClientBirthOutcomes`,
    `exportCSV`)
  - `backend/src/services/emailService.ts` (`sendDoulaMatchNotification`)
  - `backend/src/services/clientDocumentUploadService.ts`
- **Contract Findings**: No API contract change. Confirmed open:
  `GET /clients/fetchCSV` allows `client`; birth-outcomes has no assignment
  check; FE logs full client update payloads; assignment emails include client
  email + notes.
- **Drift Risk**: None for this pass (docs only).
- **Required Compatibility**: Unchanged.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (status update only)

## Preflight Update 2026-08-20

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Services Interested multiselect not showing/persisting on
  Lead Profile (production).
- **Repos Scanned**: both
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
  - `frontend-crm/src/config/clientFieldRouting.ts`
  - `frontend-crm/src/api/mappers/client.mapper.ts`
  - `backend/src/controllers/clientController.ts`
  - `backend/src/repositories/cloudSqlClientRepository.ts`
- **Context Updated**: yes
- **Implementation Started After Gate**: yes
- **Root cause**: GET `/clients/:id` merged home intake fields but omitted
  `services_interested` / service text fields; frontend multiselect without
  `altKey` only read `editedData`, not fetched detail.
- **Fix**: Backend `mergeServiceProfileFields`; frontend
  `resolveProfileFieldValue` + mapper/init for services fields; same pattern
  covers `demographics_multi`.

## Preflight Update 2026-08-20 (client detail prefetch + cache)

- **Gate Result**: `run_preflight`
- **Task Intent**: Performance — prefetch `GET /clients/:id` on row click; cache
  detail across modal open/close.
- **Files Scanned**: users-table, LeadProfileModal, useClients, clients.service,
  Clients deep-link loader
- **Context Updated**: yes
- **Implementation**: `clientDetailCache.ts` (Map cache + in-flight dedupe); row
  click prefetch; modal reads cache synchronously on open; force refresh after
  save.

## Preflight Update 2026-08-20 (local services multiselect test)

- **Gate Result**: `run_preflight`
- **Task Intent**: Local verification — Services Interested green pills not
  showing after save/read.
- **Repos Scanned**: both
- **Files Scanned**: LeadProfileModal resolve/save paths, clients.service
  fetchClientById, clientController mergeExtendedProfileFields
- **Context Updated**: yes
- **Local setup**: backend `:5050`, frontend `:3001`,
  `VITE_USE_CLOUD_RUN=false`, Cloud SQL proxy `:5433`,
  `SPLIT_DB_READ_MODE=primary`
- **Diagnostic**: GET `/clients/:id` must include `services_interested` array;
  UI reads `servicesInterested` via mapper alias.
- **Follow-up fix**: refetch detail after profile save;
  `resolveProfileFieldValue` uses `readProfileFieldFromRecord` for editedData
  (camelCase alias support).

## Preflight Update 2026-08-20 (profile form field audit)

- **Gate Result**: `run_preflight`
- **Task Intent**: Audit all Lead Profile form fields for read/persist gaps
  (same class as Home Type / Services Interested).
- **Repos Scanned**: both
- **Files Scanned**: LeadProfileModal, clientController merge paths,
  cloudSqlClientRepository map/update, profileArrayFields, client.mapper
- **Context Updated**: yes
- **Findings**:
  - Backend GET omitted many intake scalars (`preferred_contact_method`,
    `birth_location`, `primary_language`, `provider_type`,
    `relationship_status`, family phones, `demographics_multi`,
    `intake_age_years`, `children_expected`, `pets` via incomplete user
    mapping).
  - `mapRowToUser` skipped columns present on `phi_clients`;
    `updateClientOperational` blocked several saves.
  - Frontend fixed globally via `resolveProfileFieldValue` + expanded camelCase
    aliases (not only services).
  - **Not persisted** (by design / no column): `family_pronouns`, `family_email`
    on Cloud SQL intake INSERT.

## Repos

- Backend: `/Users/jerrybony/Documents/GitHub/backend`
- Frontend: `/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm`

## Doula Dashboard Map

- Route container: `src/features/doula-dashboard/DoulaDashboard.tsx`
- Tabs:
  - `components/ProfileTab.tsx`
  - `components/DocumentsTab.tsx`
  - `components/ClientsTab.tsx`
  - `components/HoursTab.tsx`
  - `components/ActivitiesTab.tsx`
- Main service: `src/api/doulas/doulaService.ts`

## Auth + Request Transport

Frontend P0 (2026-08-14) is **done and aligned with the backend**. The SPA is
not a security boundary; the API still rejects unauthorized calls. Full
write-up: `docs/SECURITY_P0_HARDENING_SUMMARY.md` → “Frontend P0”.

- Role and session: `/auth/me` (not Supabase `user_metadata`). `StaffCrmRoute` /
  `ClientPortalRoute`. `403` ≠ logout.
- CRM calls: `fetchWithAuth` (cookie + `Authorization` / `X-Session-Token` from
  sessionStorage). No global `window.fetch` patch. Signed storage blob
  downloads: raw `fetch` + `credentials: 'omit'`.
- Public intake: honeypot, `Idempotency-Key`, 429/`Retry-After`,
  `credentials: 'omit'`; test-data fill only in `DEV` or
  `VITE_ENABLE_REQUEST_TEST_DATA`. No `skip_email_notifications`. Contract
  verification not in localStorage.
- Host: Cloud Run `sokana-front-end`. API URL baked via Cloud Build
  `_VITE_APP_BACKEND_URL`. Vercel retired 2026-08-25 (`vercel.json` removed;
  CORS Vercel origins removed — see `docs/VERCEL_RETIREMENT_SIGNOFF.md`).
- Mobile login: frontend and API are different sites (`*.run.app`).
  Safari/Chrome on phones often drop the `sb-access-token` cookie even with
  `SameSite=None; Secure`. After `POST /auth/login`, store JSON `token` in
  sessionStorage and send `Authorization` + `X-Session-Token` on `/auth/me`.
  Cookie remains httpOnly for desktop; header token is the mobile fallback.
- Remaining (not this fix): XSS vs sessionStorage token; Google OAuth callback
  that only sets a cookie then redirects; Supabase `sb-auth` in localStorage;
  mobile layout (UX).

## Known Response Wrappers To Support

For doula APIs, frontend currently sees multiple wrappers and should tolerate:

- Raw array
- `{ success: true, data: [...] }`
- `{ success: true, clients: [...] }`
- `{ success: true, hours: [...] }`
- `{ success: true, activities: [...] }`
- `{ clients: [...] }`
- `{ hours: [...] }`
- `{ activities: [...] }`
- `{ data: [...] }`

## Hours Contract Notes

Backend currently returns hours through `GET /api/doulas/hours` as:

- Wrapper: `{ success: true, hours: [...] }`
- Entries may contain:
  - `start_time` and `startTime`
  - `end_time` and `endTime`
  - `client.id`, `client.firstname`, `client.lastname`
  - compatibility nested: `client.user.firstname`, `client.user.lastname`

Frontend parser in `src/api/doulas/doulaService.ts` should:

- unwrap wrappers above
- normalize date fields to `startTime`/`endTime`
- compute `hours` if not provided

## Activities Contract Notes

- Endpoint: `GET /api/doulas/clients/:clientId/activities`
- Source: Cloud SQL `public.client_activities`
- Frontend should normalize:
  - `created_at`/`createdAt`
  - `description`/`content`
  - `created_by`/`createdBy`

## Documents Contract Notes

- Endpoint: `/api/doulas/documents`
- Source: Supabase table/storage.
- Missing table in Supabase should degrade gracefully:
  - return empty list and no hard failure in UI.

## Known Fragility

- Duplicate normalization logic exists in both service and components.
- Verbose console logs can obscure real issues.
- Mixed API approaches (centralized service layer vs direct fetch modules) can
  drift.

## Stabilization Checklist (Update As Work Finishes)

- [ ] Consolidate normalization into shared API mappers.
- [ ] Reduce service/component debug logging after verification.
- [ ] Keep backwards compatibility for payload shapes until all tabs are
      updated.
- [ ] Add explicit contract tests for `clients`, `hours`, and `activities`.
- [ ] Remove deprecated fields only after frontend rollout confirms parity.

## Preflight Update 2026-03-02

### Task

- Establish a required frontend pre-task scanning workflow skill.

### Files Scanned

- `src/api/doulas/doulaService.ts`
- `src/features/doula-dashboard/components/HoursTab.tsx`
- `src/features/doula-dashboard/components/ClientsTab.tsx`
- `src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `src/features/doula-dashboard/components/DocumentsTab.tsx`
- `src/main.tsx`
- `src/common/contexts/UserContext.tsx`
- `src/common/components/routes/ProtectedRoutes.tsx`
- `src/Routes.tsx`

### Contract Findings

- Doula dashboard relies on service-layer normalization for wrapper and field
  variance.
- Hours list requires unwrapping `{ success, hours }` and mixed snake/camel
  field support.

### Drift Risk

- Backend/frontend changes can silently diverge due to mixed API styles and
  duplicated transforms.

### Required Compatibility

- Preserve wrappers (`data`, `clients`, `hours`, `activities`) and mixed field
  shapes until consolidation is complete.

### Action

- [x] Context updated
- [x] Preflight skill created

## Preflight Update 2026-03-02 (Cloud SQL doula bio column)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Add `bio` column to Cloud SQL `public.doulas`.

### Files Scanned

- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/components/ProfileTab.tsx`
- `.cursor/skills/sokana-doula-cloudsql-sync/frontend-context.md`

### Contract Findings

- Frontend expects `profile.bio` in both fetch and update profile flows.
- Backend schema currently lacked `public.doulas.bio`, so Cloud SQL could not
  store profile bio.

### Drift Risk

- Without a Cloud SQL `bio` column, profile parity remains partial and update
  persistence can drift between layers.

### Required Compatibility

- Add `bio` as nullable text in Cloud SQL with idempotent migration.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-02 (Task command rule set)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Add command-style rule mappings for `task`, `run task`, and `status` in
  backend workspace.

### Files Scanned

- `.cursor/rules/require-ticket-status-update.mdc`
- `.cursor/rules/require-frontend-preflight-skill.mdc`
- `.cursor/handoffs/open/`

### Contract Findings

- Operational workflow needed explicit command semantics for listing, executing,
  and reporting handoff tasks.

### Drift Risk

- Without command normalization, task handling behavior can vary between
  sessions.

### Required Compatibility

- Support command aliases (`tasks`, `list tasks`, `execute task`, `task status`)
  with consistent behavior.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-02 (Ticket closure + status rule)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Close completed handoff ticket and add rule to always update ticket status
  after task completion.

### Files Scanned

- `.cursor/handoffs/open/2026-03-02-backend-doula-profile-cloudsql-bio.md`
- `.cursor/rules/require-frontend-preflight-skill.mdc`

### Contract Findings

- Operational process needed enforcement: completed tasks can remain marked open
  unless explicitly closed and moved.

### Drift Risk

- Open queue can become inaccurate and cause duplicate work if status hygiene is
  not enforced.

### Required Compatibility

- Standardize completion workflow for handoff/ticket files:
  - status update,
  - checklist update,
  - completion summary,
  - move to closed folder.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-02 (Cloud SQL profile field parity)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Execute open handoff for Cloud SQL-first doula profile parity (`bio`, address
  fields, account status).

### Files Scanned

- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/components/ProfileTab.tsx`
- `backend/src/controllers/doulaController.ts`
- `backend/src/services/cloudSqlTeamService.ts`

### Contract Findings

- Frontend profile form expects `bio`, `address`, `city`, `state`, `country`,
  `zip_code`, `account_status`.
- Backend profile response must remain `{ success, profile }` and tolerate Cloud
  SQL-only doula records.

### Drift Risk

- If PUT still writes only legacy `users`, Cloud SQL-only doulas fail with
  `User not found`.
- Missing Cloud SQL columns prevent round-trip persistence for profile fields.

### Required Compatibility

- Cloud SQL-first GET/PUT for doula profile fields.
- Keep profile response compatible with existing frontend parser.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-09 (Doula Assign services 400)

### Task

- Debug "Failed to assign doula: 400 services is required" — DoulaAssignment.tsx
  calls assignDoula without services; backend requires services.

## Preflight Update 2026-03-10 (Unique client number)

### Gate Result

- run_preflight

### Task

- Auto-generate unique client_number when new client submits intake/request
  form.

### Files Scanned

- backend: src/repositories/requestFormRepository.ts,
  cloudSqlClientRepository.ts, ClientMapper.ts
- frontend-crm: src/api/dto/client.dto.ts, src/api/mappers/client.mapper.ts,
  src/domain/client.ts, src/features/clients/components/users-columns.tsx,
  LeadProfileModal.tsx

### Contract Findings

- Backend generates `client_number` (format CL-NNNNN) on phi_clients insert via
  sequence.
- Client list (GET /clients) and detail (GET /clients/:id) now include
  `client_number`.
- Frontend DTOs, mappers, and domain types updated; Client # column added to
  leads table; profile modal shows Client #.

### Drift Risk

- Existing phi_clients have null client_number; only new form submissions get
  one. Frontend tolerates missing value.

### Required Compatibility

- Preserve client_number in ClientListItemDTO and ClientDetailDTO; display as
  read-only in CRM.

### Contract Findings

- DoulaAssignment.tsx: assignDoula(clientId, doulaId, { role }) — no services
  sent
- Backend: POST /clients/:id/assign-doula requires services

## Preflight Update 2026-03-11 (Doula documents ID mismatch)

### Gate Result

- run_preflight

### Task

- Fix admin doula documents: ID mismatch between Cloud SQL doula id and Supabase
  auth user id in doula_documents.

### Files Scanned

- backend: src/controllers/doulaController.ts,
  src/services/cloudSqlTeamService.ts,
  src/repositories/doulaDocumentRepository.ts
- frontend-crm: src/api/doulas/doulaService.ts,
  src/features/doula-dashboard/components/DocumentsTab.tsx

### Contract Findings

- Admin document endpoints: GET /api/admin/doulas/:doulaId/documents, PATCH
  review, GET url. Frontend admin UI calls these with Cloud SQL doula id.
- Documents stored in Supabase doula_documents with doula_id = Supabase auth
  user id. When Cloud SQL doula id ≠ auth id, admin saw empty list.

### Drift Risk

- None. Backend fallback is transparent; frontend contract unchanged.

### Required Compatibility

- No frontend changes. Response shape unchanged.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-19 (Doula profile demographics)

### Gate Result

- run_preflight

### Task

- Doula Profile tab: gender, pronouns, required multi-select race/ethnicity,
  optional other details; persisted on `public.doulas`.

### Contract Findings

- `GET/PUT /api/doulas/profile` returns/accepts `gender`, `pronouns`,
  `race_ethnicity` (string[]), `race_ethnicity_other`,
  `other_demographic_details`.
- Migration: `src/db/migrations/add_doula_demographics_to_doulas.sql`.

### Action

- [x] Context updated

## Preflight Update 2026-03-19 (Client-visible doula activities)

### Gate Result

- run_preflight

### Task

- Doulas mark activities as visible to clients; clients only receive filtered
  list on `GET /clients/:id/activities`.

### Contract Findings

- `client_activities.metadata` jsonb stores `visibleToClient` (boolean). Default
  hidden for legacy rows (strict `=== true` to show).
- `POST /api/doulas/clients/:clientId/activities` accepts `visibleToClient` /
  `visible_to_client`.
- `GET /clients/:id/activities` reads Cloud SQL (same store as doula
  activities); role `client` allowed for own client id only; response filtered
  to visible entries.
- `POST /clients/:id/activity` (admin/doula) accepts optional
  `visible_to_client` / `visibleToClient`; persists via Cloud SQL
  `createActivity`.
- Activity DTO may include `visible_to_client` and `metadata` for staff UIs.

### Action

- [x] Context updated

## Preflight Update 2026-04-29 (Start backend + Cloud SQL)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Start backend dev server and Cloud SQL proxy for local development.

### Repos Scanned

- both

### Files Scanned

- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/DoulaDashboard.tsx`
- `frontend-crm/src/features/doula-dashboard/components/HoursTab.tsx`
- `frontend-crm/src/features/doula-dashboard/components/ClientsTab.tsx`
- `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `frontend-crm/src/features/doula-dashboard/components/DocumentsTab.tsx`
- `backend/.cursor/handoffs/open/2026-03-11-backend-doula-documents-id-mismatch.md`

### Contract Findings

- No contract changes needed for starting services.

### Drift Risk

- None.

### Required Compatibility

- None.

### Action

- [x] Context updated
- [ ] Implementation started

## Preflight Update 2026-04-29 (Cloud SQL doula languages column)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Add Cloud SQL column `public.doulas.languages_other_than_english` (TEXT[]) to
  persist doula languages.

### Repos Scanned

- both

### Files Scanned

- `backend/src/db/migrations/add_doula_demographics_to_doulas.sql`
- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/components/ProfileTab.tsx`
- `frontend-crm/src/features/doula-dashboard/DoulaDashboard.tsx`

### Contract Findings

- Frontend profile UI reads/writes `languages_other_than_english` as `string[]`
  (required field in Profile tab).
- Backend migration already includes
  `ADD COLUMN IF NOT EXISTS languages_other_than_english TEXT[]`.
- Frontend `DoulaProfile`/`UpdateProfileData` types in `doulaService.ts` may lag
  the UI usage (ensure backend accepts/returns the field regardless of frontend
  typing drift).

### Drift Risk

- If Cloud SQL schema lacks the column, `PUT /api/doulas/profile` cannot persist
  languages and `GET /api/doulas/profile` cannot round-trip the field.

### Required Compatibility

- `GET /api/doulas/profile` must return `languages_other_than_english: string[]`
  (or `null`/missing tolerated).
- `PUT /api/doulas/profile` must accept `languages_other_than_english: string[]`
  and persist to Cloud SQL.

### Action

- [x] Context updated
- [ ] Implementation started

## Preflight Update 2026-04-29 (Client birth outcomes structured)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Add structured birth outcomes fields on `public.phi_clients` and expose
  `PUT /api/clients/:id/birth-outcomes`.

### Repos Scanned

- both

### Files Scanned

- `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
- `frontend-crm/src/api/services/clients.service.ts`
- `frontend-crm/src/api/dto/client.dto.ts`
- `frontend-crm/src/api/mappers/client.mapper.ts`

### Contract Findings

- Frontend sends `PUT /api/clients/:id/birth-outcomes` with **snake_case** JSON:
  - `birth_outcomes_induction` (boolean)
  - `birth_outcomes_delivery_type` (string, one of a fixed allowed set)
  - `birth_outcomes_medications_used` (string[], non-empty, allowed set)
- Frontend expects `GET /api/clients/:id` to return the new structured fields
  when authorized, while keeping legacy `birth_outcomes` (free-text) readable
  for display/history.
- `GET /api/doula-assignments` now includes `birthOutcomesInduction`,
  `birthOutcomesDeliveryType`, `birthOutcomesMedicationsUsed` per row.
- `GET /api/doulas/clients` list returns birth outcomes fields (via
  OPERATIONAL_COLUMNS after migration).

### Drift Risk

- If backend accepts camelCase only (or stores inconsistent values), CRM save
  flows will fail and reporting fields will be unreliable.

### Required Compatibility

- Accept **snake_case** payload for the new birth outcomes endpoint.
- Return new structured fields in client detail responses when authorized; do
  not remove legacy `birth_outcomes`.
- Migration `add_phi_clients_birth_outcomes_structured.sql` must be applied to
  Cloud SQL before backend restart.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-05-04 (Birth outcomes 404 debug + full spec implementation)

### Gate Result

- `run_preflight`

### Reason

- `preflight_required_every_task`

### Task

- Fix 404 on `PUT /clients/:id/birth-outcomes`; implement full birth outcomes
  spec.

### Files Scanned

- `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
- `frontend-crm/src/common/utils/updateClient.ts`
- `frontend-crm/src/api/services/clients.service.ts`
- `backend/src/controllers/clientController.ts`
- `backend/src/repositories/cloudSqlClientRepository.ts`
- `backend/src/services/doulasService.ts`
- `backend/src/db/migrations/add_phi_clients_birth_outcomes_structured.sql`

### Contract Findings

- `PUT /clients/:id/birth-outcomes` route and controller already existed;
  returning 404 because migration not applied (columns missing).
- `GET /api/doula-assignments` response now includes `birthOutcomesInduction`,
  `birthOutcomesDeliveryType`, `birthOutcomesMedicationsUsed` (camelCase in DTO,
  snake_case in DB).
- `GET /api/doulas/clients` list now includes birth outcomes via updated
  OPERATIONAL_COLUMNS (with pre-migration fallback).

### Drift Risk

- If migration not applied, backend falls back gracefully (lists work, PUT
  returns 503 with migration message).

### Required Compatibility

- **MIGRATION REQUIRED**: Run
  `src/db/migrations/add_phi_clients_birth_outcomes_structured.sql` against
  Cloud SQL before restarting backend.

### Action

- [x] Context updated
- [x] Implementation started

---

## Preflight Update 2026-05-04

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Lead → Customer lifecycle with Leads/Customers tabs, QB
  customer creation on match
- **Repos Scanned**: both
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

### Files Scanned

- `src/features/clients/Clients.tsx`
- `src/features/clients/data/schema.ts`
- `src/features/clients/components/data-table-toolbar.tsx`
- `src/features/clients/components/users-table.tsx`
- `src/api/quickbooks/auth/customer.ts`
- `src/controllers/clientController.ts`
- `src/repositories/cloudSqlClientRepository.ts`
- `src/repositories/interface/clientRepository.ts`
- `src/dto/response/ClientDetailDTO.ts`
- `src/mappers/ClientMapper.ts`

### Contract Findings

- Frontend `schema.ts` was mapping `customer` status → `'not hired'`. Fixed to
  map → `'matched'`.
- Backend `updateClientStatus` now fires `syncMatchedClientToQuickBooks` async
  (non-blocking) when `status → matched`.
- `phi_clients` gains `matched_at TIMESTAMPTZ` and `qbo_customer_id TEXT`
  (migration required).
- `ClientDetailDTO` and `ClientMapper.toDetailDTO` now expose `matched_at` and
  `qbo_customer_id`.
- Frontend `Clients.tsx` renders Leads/Customers tabs; Leads =
  `status !== 'matched'`, Customers = `status === 'matched'`.
- `DataTableToolbar` accepts `viewMode` prop; both tabs show Status filter
  independently.

### Drift Risk

- If migration not applied, `OPERATIONAL_COLUMNS_BASE` query will fail on
  restart. Apply migration first.
- QB sync is non-blocking; if QB is not connected, sync fails silently
  (warn-level log only).

### Required Compatibility

- **MIGRATION REQUIRED**: Run
  `src/db/migrations/add_matched_lifecycle_fields_to_phi_clients.sql` against
  Cloud SQL (sokana_private).

## Preflight Update 2026-05-04

### Task

- Prevent duplicate QB customer creation: check by email then by display name
  before creating

### Files Scanned

- `src/services/customer/syncMatchedClientToQuickBooks.ts`
- `src/services/payments/findCustomerInQuickBooks.ts`
- `src/controllers/clientController.ts`

### Contract Findings

- `syncMatchedClientToQuickBooks` now runs a 3-tier dedup check before creating:
  1. CRM record already has `qbo_customer_id` → skip
  2. QB query by `PrimaryEmailAddr` → found → link existing ID, skip creation
  3. QB query by `DisplayName` (First Last) → found → link existing ID, skip
     creation
  4. Not found by either → create new QB customer
- `SyncMatchedClientResult` gains `alreadyExisted: boolean` field.
- Controller log differentiates "linked existing" vs "created new".

### Drift Risk

- No frontend contract changes; `qbo_customer_id` is stored the same way
  regardless of path.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-05-04 (Test Results Review)

### Task

- Review successful test run results and backend health status

### Files Scanned

- Terminal output showing test results (all 118 tests passing)
- Backend test coverage across request forms, email service, QB sync

### Contract Findings

- All test suites passing (17 passed, 17 total)
- Request form validation working correctly
- Email service handling both success and failure scenarios
- QuickBooks sync logic operational with proper deduplication

### Drift Risk

- None. Backend is in healthy state with full test coverage passing.

### Required Compatibility

- No changes needed - all systems operational

### Action

- [x] Context updated
- No implementation needed - observational preflight only

## Preflight Update 2026-05-04 (Client documents storage bucket RLS)

### Gate Result

- `run_preflight`

### Task Intent

- Fix lazy bucket creation for client-documents: must use Supabase service role,
  not user JWT / anon.

### Repos Scanned

- backend

### Files Scanned

- `src/services/clientDocumentUploadService.ts`
- `src/supabase.ts`
- `src/index.ts` (wiring)
- `frontend-crm` (per handoff): `clientDocuments.ts` /
  `formatClientDocumentErrorMessage` (UX only; no code change this pass)

### Contract Findings

- `ensureBucketExists` now calls `getSupabaseAdmin()` for `getBucket` /
  `createBucket` so `storage.buckets` inserts are not subject to end-user RLS.
- Follow-up: upload/delete also use the service admin client (see next preflight
  entry); the `ClientDocumentUploadService` no longer takes an injected client.

### Drift Risk

- If `SUPABASE_SERVICE_ROLE_KEY` is wrong or missing in an environment, bucket
  ensure still fails; error text now nudges Dashboard pre-creation when RLS is
  detected.

### Action

- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-05-04 (Client insurance / Medicaid card uploads)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Make client portal insurance and Medicaid ID photo uploads
  reliable (same `POST /api/clients/me/documents` with `documentType` /
  `document_type` = `insurance_card`).

- **Repos Scanned**: both

- **Files Scanned**:

  - `sokana-crm-frontend/frontend-crm/src/api/clients/clientDocuments.ts`
    (`uploadInsuranceCard`, `formatClientDocumentErrorMessage`)
  - `src/services/clientDocumentUploadService.ts`
  - `src/constants/clientDocuments.ts`
  - `src/controllers/clientController.ts` (`uploadMyDocument`)
  - `src/index.ts`
  - `src/db/migrations/create_client_documents_table.sql`

- **Contract Findings**:

  - Frontend sends `file`, `documentType` and `document_type` =
    `insurance_card`, and `category` = `billing`.
  - All Storage API calls for this feature use `getSupabaseAdmin()` (service
    role), including upload and delete, so Storage RLS on `INSERT` does not
    apply to the server path.
  - Bucket `allowed_mime_types` is widened to include `image/jpg` and common
    phone formats; an `updateBucket` sync patches existing buckets that were
    created with a narrow list (a frequent cause of “RLS”/upload failures that
    are really MIME mismatch).

- **Drift Risk**: Tightening allowed MIME types in the API without updating
  `CLIENT_DOCUMENT_BUCKET_MIME_TYPES` and the Supabase bucket can reintroduce
  storage rejections.

- **Required Compatibility**: Only `insurance_card` remains the supported
  `documentType` for this route; list/URL/delete contracts unchanged.

- **Context Updated**: yes

- **Implementation Started After Gate**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation

## Preflight Update 2026-05-11 (Request form — referral name field)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Confirm referral free-text exists end-to-end; align public
  form label and ensure staff client detail API returns saved referral fields
  when PHI-authorized.

- **Repos Scanned**: both

- **Files Scanned**:

  - `sokana-crm-frontend/frontend-crm/src/features/request/Step3Home.tsx`
    (`Step4Referral`, `referral_name` input + `useRequestForm` schema)
  - `sokana-crm-frontend/frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
    (Referral Information section)
  - `src/controllers/clientController.ts` (`getClientById` PHI merge)
  - `src/services/RequestFormService.ts` /
    `src/repositories/requestFormRepository.ts` (persistence)
  - `src/dto/response/ClientDetailDTO.ts`

- **Contract Findings**:

  - Intake payload uses snake_case `referral_source`, `referral_name`,
    `referral_email`; `referral_name` is optional in zod.
  - Canonical `GET /clients/:id` merges extra fields from
    `findClientDetailedById().user` for authorized callers; referral fields must
    be included in that merge for CRM to display saved intake values.

- **Drift Risk**: CRM assumes API returns `referral_*` on client detail for
  authorized staff.

- **Required Compatibility**: Optional `referral_name` on submit; authorized
  client detail must include `referral_source`, `referral_name`,
  `referral_email` when present on the Cloud SQL row.

- **Context Updated**: yes

- **Implementation Started After Gate**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-05-26 (Invoices: Cloud SQL ledger, QBO SOR)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Remove Supabase invoice persistence; use QuickBooks as
  invoice object source-of-truth and Cloud SQL `phi_invoices` as CRM ledger
  source-of-truth.
- **Repos Scanned**: both
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

### Files Scanned

- `sokana-crm-frontend/frontend-crm/src/api/financial/invoicesApi.ts`
- `sokana-crm-frontend/frontend-crm/src/api/quickbooks/auth/invoice.ts`
- `sokana-crm-frontend/frontend-crm/src/api/quickbooks/auth/customer.ts`
- `sokana-crm-frontend/frontend-crm/src/features/InvoicesPage/InvoicesPage.tsx`
- `backend/src/routes/invoiceRoutes.ts`
- `backend/src/repositories/cloudSqlInvoiceRepository.ts`
- `backend/src/controllers/quickbooksController.ts`
- `backend/src/services/customer/getInvoiceableCustomers.ts`
- `backend/src/services/invoice/createInvoice.ts`
- `backend/src/services/invoice/createInvoiceInQuickBooks.ts`
- `backend/src/services/invoice/persistInvoiceToSupabase.ts`

### Contract Findings

- Invoice list UI reads **Cloud SQL** via `GET /api/invoices` and tolerates
  `{ success: true, data: [...] }` (frontend normalizes wrapper/array).
- Invoice creation UI posts to `POST /quickbooks/invoice` with
  `{ internalCustomerId, lineItems, dueDate, memo }` (cookies/credentials
  included).
- Invoiceable customers list uses `GET /quickbooks/customers/invoiceable` and
  expects `{ id, qboCustomerId, name, email }[]` where `id` is the **Cloud SQL**
  client id.

### Drift Risk

- Backend invoice creation currently looks up `qbo_customer_id` from
  **Supabase** `customers`, which can drift from the Cloud SQL client list used
  by the UI.
- Writing invoices into Supabase `invoices` causes Cloud SQL `GET /api/invoices`
  to miss newly created invoices, breaking ledger/reporting parity.

### Required Compatibility

- Keep `GET /api/invoices` response shape stable:
  `{ success: true, data: InvoiceRow[] }`.
- Keep `GET /quickbooks/customers/invoiceable` stable and Cloud SQL-based.
- `POST /quickbooks/invoice` must create invoice in QBO, then **upsert** a Cloud
  SQL `phi_invoices` ledger row keyed to Cloud SQL `phi_clients.id`.

### Action

- [x] Context updated
- [ ] Implementation started

## Preflight Update 2026-05-11 (Expanded primary insurance / Medicaid parity)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Align backend billing + intake with CRM expanded insurance
  fields (policy holder, plan type; optional group `policy_number` for all
  insurance payment methods including Medicaid).

- **Repos Scanned**: both

- **Files Scanned**:

  - `sokana-crm-frontend/frontend-crm/src/features/client-dashboard/components/ClientProfileTab.tsx`
    (billing GET/PUT, `primaryInsuranceDetails`-style fields,
    `needsInsuranceDetails`)
  - `sokana-crm-frontend/frontend-crm/src/features/request/__tests__/useRequestForm.test.tsx`
    (intake field names)
  - Backend (this task): `clientController`, `RequestFormService`,
    `requestFormRepository`, `cloudSqlClientRepository`, migrations

- **Contract Findings**:

  - Portal billing PUT sends snake*case:
    `insurance_policy_holder*\*`, `insurance_plan_type`, optional `policy_number`, plus legacy `insurance`
    mirroring provider.
  - Billing GET merge tolerates snake_case and camelCase for display
    (`insurancePolicyHolderName`, etc.).
  - Intake uses `RequestFormService.newForm` → Cloud SQL `phi_clients` INSERT.

- **Drift Risk**: CRM validates required insurance fields client-side; backend
  must enforce the same when payment is Commercial, Private, or Medicaid or
  saves will diverge.

- **Required Compatibility**: Support four new columns on read/write; do not
  require `policy_number` for Medicaid; return new fields on billing and merged
  client detail.

- **Context Updated**: yes

- **Implementation Started After Gate**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-05-11 (Handoff: `referral_source_other` intake + CRM)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Open backend handoff ticket for `referral_source_other`
  validation, persistence on `phi_clients`, and staff client APIs; no
  implementation in this step.

- **Repos Scanned**: both

- **Files Scanned**:

  - `sokana-crm-frontend/frontend-crm/src/features/request/Step3Home.tsx`
    (referral fields, clear `referral_source_other` when leaving `Other`)
  - `sokana-crm-frontend/frontend-crm/src/features/request/__tests__/useRequestForm.test.tsx`
    (zod: `Other` requires non-empty `referral_source_other`)
  - `sokana-crm-frontend/frontend-crm/src/api/dto/client.dto.ts`
    (`referral_source_other`)
  - Backend: `src/routes/requestRoute.ts`, `src/services/RequestFormService.ts`,
    `src/repositories/requestFormRepository.ts`,
    `src/repositories/cloudSqlClientRepository.ts`,
    `src/controllers/clientController.ts`, `src/dto/response/ClientDetailDTO.ts`

- **Contract Findings**:

  - Intake and CRM expect **snake_case** `referral_source_other` alongside
    `referral_source`, `referral_name`, `referral_email`.
  - Frontend requires trimmed non-empty `referral_source_other` when
    `referral_source === "Other"`; allowed sources include `Google`,
    `Doula Match`, `Former client`, `Sokana Member`, `Social Media`,
    `Email Blast`, `Other`.

- **Drift Risk**: Backend omitting the column, INSERT list, allowlist, or DTO
  merge will drop the field silently after frontend ships.

- **Required Compatibility**: Validate `Other` + required other-text on
  `POST /requestService/requestSubmission`; persist and return on Cloud SQL
  client row; staff update can set/clear; clearing when source ≠ `Other` should
  match ticket (server-side clear recommended).

- **Context Updated**: yes

- **Implementation Started After Gate**: yes (completed 2026-05-11)

- **Action**:
  - [x] Context updated
  - [x] Implementation (see
        `.cursor/handoffs/closed/2026-05-11-backend-request-intake-referral-source-other.md`)

## Preflight Update 2026-05-19 (birth place + intake payment)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: `POST /requestService/requestSubmission` — validate/persist
  `birth_location` + `birth_hospital`; intake payment four CRM labels; reject
  Medicaid.

- **Repos Scanned**: both

- **Files Scanned**:

  - `frontend-crm/docs/BACKEND_REQUEST_FORM_BIRTH_LOCATION_AND_PAYMENT_VERIFY_PROMPT.md`
  - `frontend-crm/src/features/request/useRequestForm.ts`,
    `src/lib/paymentRules.ts`, `dummyTestLead.ts`
  - Backend: `src/intake/requestSubmissionDto.ts`, `RequestFormService.ts`,
    `requestFormRepository.ts`

- **Contract Findings**: `birth_hospital` required with `birth_location`; four
  intake payment labels; Medicaid 400 on public path;
  `Private/Commercial Insurance` → `Commercial Insurance` in DB.

- **Drift Risk**: Legacy Medicaid/self-pay labels accepted on intake; birth
  fields not validated or inserted.

- **Required Compatibility**: Location-specific 400 messages; both birth columns
  on INSERT; staff Medicaid via client APIs unchanged.

- **Context Updated**: yes | **Implementation**: yes

## Preflight Update 2026-05-24 (request submission — full CRM POST → phi_clients)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Handoff prompt — tests + persistence for CRM `/request`
  submit (`DUMMY_TEST_LEAD` shape): age, provider_type, address parts, birth
  place, pronouns/contact, pets, `services_interested` /
  `service_support_details`, `service_needed`, insurance paths.

- **Repos Scanned**: both

- **Files Scanned**:

  - `frontend-crm/src/features/request/dummyTestLead.ts`, `RequestForm.tsx`
    (submit transforms), `useRequestForm.ts`
  - Backend: `src/intake/requestSubmissionDto.ts`, `RequestFormService.ts`,
    `requestFormRepository.ts`,
    `src/db/migrations/add_phi_clients_intake_crm_fields.sql`
  - Tests: `requestSubmissionDto.test.ts`, `requestSubmissionFlow.test.ts`,
    `requestEndpoint.test.ts`

- **Contract Findings**:

  - POST body = spread `RequestFormValues` + numeric `number_of_babies` +
    `service_needed` from services join or support text.
  - `age` → `intake_age_years`; `provider_type` includes `Family Doctor` →
    `Family Physician`; `Private/Commercial Insurance` →
    `Commercial Insurance` + expanded primary/secondary billing validation.

- **Drift Risk**: INSERT omitting CRM keys leaves Cloud SQL null while DevTools
  shows data; intake payment labels outside four-option set 400.

- **Required Compatibility**: Persist `city`, `state`, `zip_code`,
  `birth_location`, `birth_hospital`, `provider_type`, `pronouns`,
  `preferred_contact_method`, `intake_age_years`, `pets`,
  `services_interested[]`, `service_support_details`, `service_needed`; run
  migration on PHI DB before manual QA.

- **Context Updated**: yes | **Implementation**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-05-24 (home step persistence)

- **Gate Result**: `run_preflight` | **Handoffs**: `no_open_handoff_tasks`
- **Task Intent**: Persist CRM home step on `phi_clients`: `home_access`,
  `home_types[]`, `home_type_other`, `home_adults_count`, `home_youth_count` (+
  legacy `home_type` VARCHAR).
- **Files Scanned**: `dummyTestLead.ts`, `useRequestForm.ts`,
  `homeTypeOptions.ts`, `homePeopleCountOptions.ts`; backend
  `requestFormRepository.ts`, `RequestFormService.ts`,
  `requestSubmissionDto.ts`.
- **Required Compatibility**: CRM sends `home_type` as string array; counts
  `0`–`5+`; validate counts on intake; migration
  `add_phi_clients_home_intake_fields.sql` before manual QA.
- **Context Updated**: yes | **Implementation**: yes

## Preflight Update 2026-05-24 (birth place + intake payment verification)

- **Gate Result**: `run_preflight` | **Handoffs**: `no_open_handoff_tasks`
- **Task Intent**: Verify May 2026 prompt — `birth_location` + `birth_hospital`
  validation/persistence; four intake payment labels; reject Medicaid on public
  `requestSubmission` only.
- **Files Scanned**: `requestSubmissionDto.ts`, `RequestFormService.ts`,
  `requestFormRepository.ts`, `clientController.ts`,
  `clientBillingEndpoint.test.ts`; frontend `useRequestForm.ts`,
  `dummyTestLead.ts`.
- **Contract Findings**: `validateIntakeBirthPlace` + `parseIntakePaymentMethod`
  in intake DTO; `newForm` applies both; INSERT binds
  `birth_location`/`birth_hospital` (params 9–10); staff billing still accepts
  Medicaid via client APIs.
- **Definition of done**: all checklist items satisfied; PHI DB has
  `birth_location` + `birth_hospital` columns.
- **Context Updated**: yes | **Implementation**: verified (no mapper changes
  required)

## Preflight Update 2026-05-12 (request submission tests + intake DTO)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Align backend tests with CRM
  `POST /requestService/requestSubmission` contract (age, provider_type,
  secondary insurance, payment label, `number_of_babies` / `service_needed`).

- **Repos Scanned**: both

- **Files Scanned**:

  - `sokana-crm-frontend/frontend-crm/docs/BACKEND_REQUEST_SUBMISSION_TEST_PROMPT.md`
  - `sokana-crm-frontend/frontend-crm/src/features/request/dummyTestLead.ts`
    (`DUMMY_TEST_LEAD`)
  - `sokana-crm-frontend/frontend-crm/src/features/request/useRequestForm.ts`
    (age 1–120; `Private/Commercial Insurance`; provider options include
    `Family Doctor`)
  - Backend: `src/services/RequestFormService.ts`,
    `src/repositories/requestFormRepository.ts`, `src/routes/requestRoute.ts`

- **Contract Findings**:

  - Submit sets `number_of_babies` as a number and `service_needed` to
    `services_interested.join(', ')` or trimmed support text.
  - CRM payment option `Private/Commercial Insurance` must map to backend
    commercial path (`Commercial Insurance`) for validation/persistence.
  - `provider_type` options include `Family Doctor` (backend enum uses
    `Family Physician`).

- **Drift Risk**: Tests that omit `age` / `provider_type` no longer reflect the
  CRM full submit path; payment string mismatch would 400 on intake.

- **Required Compatibility**: Normalize `Private/Commercial Insurance` →
  `Commercial Insurance`; validate age 1–120 and provider_type (with
  `Family Doctor` alias); enforce secondary fields when
  `has_secondary_insurance` is true (shared with `expandedInsuranceBilling`).

- **Context Updated**: yes

- **Implementation Started After Gate**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-05-26

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix production `GET /clients/team/all` UNION column mismatch
  (`listTeamMembers`).

- **Repos Scanned**: both

- **Files Scanned**:

  - `sokana-crm-frontend/frontend-crm/src/features/teams/teams.tsx` (`fetch` →
    `/clients/team/all`, raw array)
  - `backend/src/services/cloudSqlTeamService.ts` (`listTeamMembers` UNION)
  - `backend/src/controllers/userController.ts`

- **Contract Findings**:

  - Frontend expects a JSON array of team members with `role` in `admin` |
    `doula`; errors surface as toast + console.

- **Drift Risk**: Admin UNION branch must pad the same nullable columns as
  doulas (`languages_other_than_english` before `role`).

- **Required Compatibility**: No response-shape change; fix SQL only.

- **Context Updated**: yes

- **Implementation Started After Gate**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-07-08

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Backend-owned portal eligibility, onboarding readiness
  persistence, and client API readiness fields.
- **Repos Scanned**: backend + frontend-crm
- **Files Scanned**:

  - `frontend-crm/src/api/dto/client.dto.ts`
  - `frontend-crm/src/api/mappers/client.mapper.ts`
  - `frontend-crm/src/features/clients/utils/portalStatus.ts`
  - `frontend-crm/src/features/clients/Clients.tsx`
  - `frontend-crm/docs/FAMILY_ONBOARDING_SOP.md`
  - `backend/src/controllers/clientController.ts`
  - `backend/src/dto/response/ClientDetailDTO.ts`
  - `backend/src/dto/response/ClientListItemDTO.ts`

- **Contract Findings**:

  - Frontend already prefers backend `is_eligible` in `portalStatus.ts` but
    still has client-side contract/payment fallbacks.
  - Frontend DTO placeholders include `payment_authorization_status`; backend
    now returns `payment_authorization_required`,
    `payment_authorization_satisfied`, `card_on_file`, `portal_blockers`,
    `primary_portal_blocker`, and `allowed_actions`. Historical
    verification-invoice metadata remains deprecated and reconciliation-only.
  - Client mappers currently map only `is_eligible`; new readiness fields are
    additive.

- **Drift Risk**:

  - Local frontend blocker logic can disagree with backend `allowed_actions`.

- **Required Compatibility**:

  - Preserve `is_eligible` on list/detail responses.
  - Additive snake_case readiness fields on GET `/clients` and GET
    `/clients/:id`.
  - Keep legacy `qbo_customer_id` while also exposing `qb_customer_id`.

- **Context Updated**: yes
- **Implementation Started After Gate**: yes

- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-07-08 (portal readiness API test)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Run portal readiness API oracle with staff test admin
  `info@techluminateacademy.com`.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: backend only (API verification)
- **Files Scanned**: `docs/PORTAL_READINESS_TEST_PLAN.md`,
  `scripts/test/.env.test-readiness.example`, `.env`
- **Compatibility**: No API contract change; staff JWT login confirmed for GET
  `/api/clients/:id` readiness fields.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-10 (Cloud Run gradual cutover probe)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Probe terminal access to Cloud Run private API before gradual
  env-flag cutover from Vercel.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: backend docs only (no frontend contract change yet)
- **Files Scanned**:
  - `docs/dev-cloudrun-auth.md`
  - `docs/CLOUD_SQL_LOCAL_TEST.md`
  - `docs/PRODUCTION_CLOUD_SQL_VERCEL.md`
- **Contract Findings**:
  - App auth remains Supabase JWT (cookie/`Authorization`/`X-Session-Token`).
  - Cloud Run service URL is IAM-gated; terminal/scripts need a Google identity
    token in addition to Supabase session for protected invoke.
- **Drift Risk**: None yet — no env-flag routing implemented.
- **Compatibility assumptions**: Keep frontend `NEXT_PUBLIC_API_URL` / Vercel
  base URL unchanged until explicit cutover flag; Supabase login flow unchanged.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (access probe only)

## Preflight Update 2026-08-10 (Cloud Run Cloud SQL SSL/password fix)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Cloud Run Cloud SQL SSL and password so `/clients` can
  read sokana_private.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: backend
- **Files Scanned**: `src/db/cloudSqlPool.ts`, Cloud Run service env/secrets,
  `deploy.sh`
- **Findings**:
  - Unix socket `/cloudsql/...` must use `CLOUD_SQL_SSLMODE=disable`; prior pool
    code forced SSL when `NODE_ENV=production`.
  - `DB_PASSWORD` secret v1 mismatched local `CLOUD_SQL_PASSWORD`; synced to
    secret v2 and bound as `latest`.
- **Compatibility**: No frontend contract change; Supabase remains app auth.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-10 (frontend Cloud Run cutover flag)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Gradual frontend cutover to Cloud Run API for local login
  test.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: frontend-crm + backend CORS
- **Files Scanned**:
  - `frontend-crm/src/config/env.ts`
  - `frontend-crm/src/api/http.ts`
  - `frontend-crm/src/common/contexts/UserContext.tsx`
  - `frontend-crm/.env`
  - `backend/src/config/env.ts` (getAllowedOrigins)
- **Contract Findings**:
  - Frontend uses `VITE_USE_CLOUD_RUN=true` → `VITE_CLOUD_RUN_API_URL` for API
    base.
  - Auth remains cookie mode (`credentials: include`) against Cloud Run; Cloud
    Run must allow `http://localhost:3001` in `FRONTEND_ORIGIN`.
- **Drift Risk**: Missing CORS origin causes browser login "Failed to fetch".
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-10 (team members empty on Cloud Run cutover)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Team page empty list after Cloud Run cutover.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: frontend-crm + backend logs
- **Files Scanned**: `frontend-crm/src/features/teams/teams.tsx`, local backend
  logs (`/clients/team/all` 401)
- **Findings**: Team page hard-coded `VITE_APP_BACKEND_URL` (localhost:5050),
  bypassing `VITE_USE_CLOUD_RUN` / `apiBaseUrl`. Cookie from Cloud Run login was
  not sent to localhost → 401 empty UI.
- **Fix**: Use `buildUrl` + `fetchWithAuth` for team list/update/delete/invite.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-10 (hard-coded backend URL sweep)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Replace hard-coded `VITE_APP_BACKEND_URL` fetches with
  `apiBaseUrl` / `buildUrl` / `fetchWithAuth` so Cloud Run cutover flag works
  app-wide.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Files changed (prod)**: teams + adminService, doulaApi, notes,
  doulaAssignments, signNowService, qb status, client utils, hooks, Clients,
  auth, contracts, hours, request, integrations, ClientProfileTab.
- **Left intentional**: `env.ts` resolver, type defs, error strings, test stubs.
- **Context Updated**: yes

## Preflight Update 2026-08-10 (backend test run)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Run backend unit/build checks after Cloud Run cutover work.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: backend only
- **Files Scanned**: `package.json` scripts
- **Compatibility**: No API/frontend contract changes in this verification pass.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes (test execution only)

## Preflight Update 2026-08-10 (Cloud Run FE→API cutover wiring)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Wire Cloud Run frontend login to Cloud Run API via CORS +
  frontend redeploy.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Actions**:
  - API `FRONTEND_ORIGIN` now includes Cloud Run FE URLs + localhost + Vercel.
  - Triggered frontend Cloud Build (bake `VITE_APP_BACKEND_URL` = Cloud Run
    API). Build SUCCESS.
- **Context Updated**: yes

## Preflight Update 2026-08-10 (contract templates locate + download)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Locate contract templates in Supabase storage / local repo;
  download existing templates locally.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: both
- **Files Scanned**: `frontend-crm/src/common/hooks/contracts/useTemplates.ts`,
  `frontend-crm/src/common/types/template.ts`, backend
  `supabaseContractService`, storage bucket `contract-templates`
- **Findings**:
  - Supabase table `public.contract_templates` missing (PGRST205).
  - Bucket `contract-templates` has 2 DOCX templates (Postpartum + Labor
    Support).
  - No source template DOCX/PDF in repo; only generated outputs under
    `generated/`.
  - Downloaded both to `backend/templates/`.
- **FE contract expect**: `GET /contracts/templates` →
  `{ id, name, depositFee, serviceFee, storagePath }[]` (currently 404 on API).
- **Context Updated**: yes
- **Implementation Started After Gate**: download only (no route wiring yet)

## Preflight Update 2026-08-10 (contracts templates storage list)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Load existing Supabase storage DOCX templates into Contracts
  UI Templates panel via storage-only listing.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: both
- **Files Scanned**: `frontend-crm/src/common/hooks/contracts/useTemplates.ts`,
  `PdfPreview.tsx`, `NewTemplateDialog.tsx`, `EditTemplateDialog.tsx`,
  `Viewport.tsx`, backend `supabaseContractService.ts`, `server.ts`
- **Compatibility assumptions**:
  - FE calls `GET /contracts/templates` expecting
    `{ id, name, depositFee, serviceFee, storagePath }[]`.
  - Storage-only mode returns depositFee/serviceFee as 0 (no
    `contract_templates` table).
  - Template display name is storage filename without extension.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-10 (templates empty UI auth/cache)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Contracts Templates panel empty despite storage templates
  existing.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Root cause**: GET /contracts/templates returned 304 under React Strict Mode
  double-fetch; FE treated !ok and cleared list. Cookie-only auth also
  intermittent after Cloud Run cutover.
- **Fix**: Bearer+cookie in getRequestAuth; cache:no-store on template fetch;
  Cache-Control:no-store on route; show error in Viewport.
- **Context Updated**: yes

## Preflight Update 2026-08-10 (contracts preview + layout)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix template preview on select + widen Contracts templates
  panel.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: both
- **Files Scanned/Changed**: `PdfPreview.tsx` (Office Online embed of public
  DOCX), `Viewport.tsx`, `TemplateItem.tsx`
- **Compatibility**: Preview no longer depends on POST
  `/contracts/templates/generate` + CloudConvert; uses public Supabase storage
  URL + Office viewer.
- **Context Updated**: yes

## Preflight Update 2026-08-10 (Customers QB not-connected UX)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Replace raw HTML 404 on Customers page with friendly “connect
  QuickBooks” empty state.
- **Handoff inbox**: `no_open_handoff_tasks`
- **Files**: `createCustomer.tsx`, `api/quickbooks/auth/customer.ts`
- **Behavior**: Check `/quickbooks/status` first; if disconnected or invoiceable
  route missing, show CTA to `/integrations/quickbooks` instead of error HTML.
- **Context Updated**: yes

## Preflight Update 2026-08-10 (ship trimmed PRs to main)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Ship contracts templates API + FE Contracts/Customers UX
  enhancements to main via trimmed PRs (exclude docs, binaries, local-only
  churn).
- **Handoff inbox**: `no_open_handoff_tasks`
- **Repos Scanned**: both
- **Files Scanned (shipping)**:
  - Backend: `contractTemplateRoutes.ts`, `server.ts`,
    `supabaseContractService.ts/.js`, `contractController.ts`,
    `authorizeRoles.ts`
  - Frontend: `http.ts`, `useTemplates.ts`, `Viewport.tsx`, `PdfPreview.tsx`,
    `ContractRoutes.tsx`, `sidebar-data.ts(+test)`, `createCustomer.tsx`,
    `quickbooks/auth/customer.ts`
- **Excluded**: `templates/*.docx`, architecture docs, portal-readiness
  doc/script edits, `.env`
- **Compatibility**:
  - FE expects `GET /contracts/templates` → template array; BE lists Supabase
    storage (+ filename fallback).
  - Preview uses public storage URL + Office Online embed (no
    generate/CloudConvert required).
  - Customers page soft-fails when QB disconnected / invoiceable route 404.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes (PR ship)

## Preflight Update 2026-08-10 (architecture boundary todos)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Capture architecture assessment as open frontend + backend
  handoff todos (no implementation).
- **Handoff inbox**: after this task → `open_handoff_tasks_found`:
  - `2026-08-10-backend-architecture-boundary-refactor.md`
  - frontend `2026-08-10-frontend-architecture-boundary-refactor.md`
- **Repos Scanned**: both (assessment + handoff conventions only)
- **Files Scanned**:
  - Backend: `.cursor/handoffs/README.md`, `todo.md`,
    `docs/Backend_Architecture_Boundary_Assessment.docx` (referenced)
  - Frontend: `.cursor/handoffs/README.md`,
    `.cursor/skills/sokana-cross-repo-handoff/SKILL.md`
- **Contract Findings**: FE still has global fetch patch + multi-credential
  HTTP; BE has alias surface + partial composition root; auth transport
  dual-support required before cutover.
- **Drift Risk**: Independent BE/FE auth or QB-sync ownership changes without
  dual-support will break pilot flows.
- **Required Compatibility**: Preserve routes/responses; dual-support
  cookies/headers during token migration; FE QB sync removal only after BE
  idempotent ownership.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (todo/handoff creation only)

## Preflight Update 2026-08-11 (PR 1 feature-package guardrails)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Document backend feature-package guardrails only
  (`src/features/README.md`); no production moves or API changes.
- **Handoff inbox**: `open_handoff_tasks_found`:
  - `2026-08-10-backend-architecture-boundary-refactor.md`
    (architecture-assessment→backend; this task)
  - frontend companion: `2026-08-10-frontend-architecture-boundary-refactor.md`
    (out of scope)
- **Repos Scanned**: both (docs/architecture only; no contract edits)
- **Files Scanned**:
  - Backend:
    `.cursor/handoffs/open/2026-08-10-backend-architecture-boundary-refactor.md`,
    `src/features/` (existing `invoices`, `quickbooks` only),
    `src/controllers/requestFormController.ts`, `src/routes/requestRoute.ts`,
    `src/services/RequestFormService.ts`
  - Frontend: `src/features/` package list (incl. `request`), companion handoff
    path only
- **Contract Findings**: No request/response contract changes in this PR. Public
  request intake remains on legacy controllers/routes/services until a later
  structural slice.
- **Drift Risk**: None for this PR (documentation + handoff status only).
- **Required Compatibility**: Preserve all existing routes and payloads; do not
  create empty feature packages or move imports yet.
- **Compatibility assumptions**: Frontend continues to call current
  intake/portal endpoints unchanged; backend package layout docs do not imply
  runtime relocation.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes (docs/handoff only)

## Preflight Update 2026-08-11 (PR 2 baseline and CI)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Baseline + CI gate only (route inventory, Jest open-handle
  fix, GH Actions test gate, security-smoke scaffold); no API/security/behavior
  changes.
- **Handoff inbox**: `open_handoff_tasks_found`:
  - `2026-08-10-backend-architecture-boundary-refactor.md` (this task)
  - frontend companion remains open (out of scope)
- **Repos Scanned**: both (contracts referenced for freeze docs only)
- **Files Scanned**:
  - Backend: `src/server.ts`, `src/routes/*.ts`, `jest.config.js`,
    `.github/workflows/lint.yaml`, `cloudbuild.yaml`,
    `src/__tests__/requestEndpoint.test.ts`
  - Frontend: feature package list / companion handoff only (no FE edits)
- **Contract Findings**: Inventory frozen in
  `docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md`; wrappers remain mixed
  (`ApiResponse`, `{success,…}`, `{data,meta}`, portal `{ok}`).
- **Drift Risk**: None from this PR if CI/docs-only; FE still depends on
  existing aliases and cookie auth.
- **Required Compatibility**: Preserve routes, status codes, response fields,
  `/health` semantics, Cloud Run single service.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-11 (PR 2.1 deployment gate alignment)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Enforce Cloud Build deploy-path test gate + align lint
  workflow to Node 20; no API/auth/runtime changes.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: backend only (CI/deploy config)
- **Files Scanned**: `cloudbuild.yaml`, `.github/workflows/lint.yaml`,
  `.github/workflows/test.yml`, `package.json` engines
- **Contract Findings**: No request/response changes.
- **Drift Risk**: None for FE contracts; deploy now blocked when the test gate
  fails.
- **Required Compatibility**: Preserve Cloud Run service `sokana-private-api`,
  region, Artifact Registry image path, entrypoint `node dist/cloudrun.js`.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-12 (PR 3 immediate containment)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Remove localhost telemetry; redact sensitive logs; sanitize
  API error bodies; add containment regression tests. No auth/route/folder
  migration.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: backend (controllers/routes/services logging + error
  paths); FE companion not modified
- **Contract Findings**: Success bodies unchanged. Some 500 error bodies
  intentionally sanitized (security bug fixes).
- **Drift Risk**: FE that displayed raw `error.details` / provider messages on
  contract-signing/SignNow failures will now see generic messages.
- **Required Compatibility**: Preserve success JSON/status codes; endpoint auth
  remains PR 4.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-12 (PR 4 endpoint authorization)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Authorization matrix + protect previously anonymous
  payment/signing/QB/email routes; ownership policies; auth-matrix tests. No
  webhook signatures / no folder moves.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both (FE callers for createContract / signNow /
  paymentsApi)
- **Files Scanned**: FE `createContract.ts`, `signNowService.ts`,
  `paymentsApi.ts`; BE route modules listed in matrix
- **Contract Findings**: Success bodies unchanged. Newly denied anonymous calls
  return existing 401/403 shapes. QB invoice-paid webhook no longer requires CRM
  session.
- **Drift Risk**: Unauthenticated scripts hitting signing/payment tooling will
  now get 401 (intentional security fix).
- **Required Compatibility**: Preserve public URLs/aliases; FE admin cookie auth
  required for contract generation / SignNow send (already used).
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-12 (PR4 auth matrix audit)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Produce complete Express route auth matrix (authenticated vs
  unauthenticated) with PR4 hardening plan; no implementation edits yet.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both (backend route files + FE callers for
  contract-signing/payments/QB customers)
- **Files Scanned**:
  - backend: `src/server.ts`, all listed `src/routes/*.ts`
  - frontend: `src/common/utils/createContract.ts`,
    `src/services/signNowService.ts`, `src/api/financial/paymentsApi.ts`,
    `src/api/quickbooks/auth/customer.ts`
- **Contract Findings**: FE already sends credentials via global fetch wrapper;
  contract-signing + SignNow send + QB customers calls assume session cookies
  work once auth is added.
- **Drift Risk**: Adding `authMiddleware`+`authorizeRoles` to currently-open
  payment/contract/SignNow/QB-customer routes will 401 unauthenticated callers;
  FE admin contract flows must remain logged-in.
- **Required Compatibility**: Keep public: health, login/signup/OAuth,
  requestSubmission, SignNow `/callback`, QB `/auth`+`/callback`. Prefer moving
  QB webhook registration before `authMiddleware` in PR4.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (audit-only)

## Preflight Update 2026-08-14 (PR 5 webhooks and OAuth)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Provider webhook signature + replay/idempotency;
  cryptographically secure single-use QB OAuth state. Keep public URLs.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both
- **Files Scanned**:
  - backend: SignNow/QB webhook controllers + routes, `quickbooksAuthService`,
    `quickbooksController`, `server.ts` body parser
  - frontend: `useQuickBooksIntegration.ts`, `api/quickbooks/auth/route.ts`
    (expects `{ url }` from `/quickbooks/auth/url` or `/auth`; does not parse
    OAuth state)
- **Contract Findings**: FE OAuth success contract remains `{ url: string }`.
  Callback is browser redirect (not FE JSON). Webhooks are provider→backend only
  (no FE callers).
- **Drift Risk**: Unsigned webhook POSTs return 401 when secrets are configured
  / in production. Invalid/reused OAuth `state` fails callback (redirect to
  `?quickbooks=error`). Requires Cloud SQL tables `webhook_events` +
  `oauth_states` and env `SIGNNOW_WEBHOOK_SECRET` / `QB_WEBHOOK_VERIFIER_TOKEN`.
- **Required Compatibility**: Preserve paths `POST /api/signnow/callback`,
  `POST /quickbooks/webhooks/invoice-paid` (+ `/api` alias),
  `GET /quickbooks/auth`, `/callback`, `/auth/url`.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (PR 6 auth exploration)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Explore authentication for PR 6 (authoritative roles, cookie
  stability, dual-support token transport + legacy telemetry). Exploration only
  — no implementation.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both
- **Files Scanned**:
  - backend: `src/middleware/authMiddleware.ts`, `authorizeRoles.ts`,
    `authController.ts`, `supabaseAuthService.ts`, `usecase/authUseCase.ts`,
    `repositories/supabaseUserRepository.ts`, `services/cloudSqlTeamService.ts`,
    `services/portalInviteService.ts`, `security/authorizationPolicies.ts`,
    `server.ts`, `routes/authRoutes.ts`, `controllers/debugController.ts`
  - frontend: `src/api/http.ts`, `src/api/config.ts`, `src/api/authToken.ts`,
    `src/common/contexts/UserContext.tsx`,
    `src/common/components/routes/ProtectedRoutes.tsx`,
    `src/common/auth/roles.ts`, `src/features/auth/AuthCallback.tsx`,
    `src/main.tsx`, `ClientProfileTab.tsx` (Bearer + X-Session-Token)
- **Contract Findings**:
  - FE default `VITE_AUTH_MODE=cookie`; `getRequestAuth` always attaches
    Bearer + `X-Session-Token` when Supabase session exists, and uses
    `credentials: 'include'` in cookie mode.
  - Global `main.tsx` fetch patch forces `credentials: 'include'` for
    non-Supabase URLs.
  - Login cookie mode expects `Set-Cookie: sb-access-token` + optional JSON
    `token`; `/auth/me` drives `user.role` for sidebar/route guards.
  - OAuth callback posts JSON `{ access_token }` to `POST /auth/callback`
    (legacy body token path).
  - No FE usage of query-string session tokens for API auth; hash
    `#access_token=` used only for Supabase recovery/set-password flows.
- **Drift Risk**: If `/auth/me` stops preferring `user_metadata.role`, FE
  admin/doula/billing nav depends on DB/Cloud SQL role being correct. Cookie
  name split (`sb-access-token` vs `session`) can strand OAuth users.
- **Required Compatibility**: Keep cookie + Bearer + X-Session-Token
  dual-support; keep login JSON `token` field until telemetry proves unused; do
  not fail-closed clients on missing staff row.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (exploration-only)

## Preflight Update 2026-08-14 (PR 6 authentication compatibility)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Authoritative DB/app-managed roles (no staff from
  `user_metadata`); standardize `sb-access-token` cookies; dual-support
  header/cookie (+ legacy `session` cookie); measure legacy token transports
  without retiring them.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both (reuse PR 6 exploration scan)
- **Contract Findings**: FE still expects `/auth/me` `{ …, role }` and login
  `{ user, token }` + `Set-Cookie`. Role source changes from metadata override
  to Cloud SQL / `public.users` only.
- **Drift Risk**: Users whose only staff signal was forged/stale
  `user_metadata.role` lose staff access (intentional).
  OAuth/`POST /auth/callback` now sets `sb-access-token` (also clears legacy
  `session`).
- **Required Compatibility**: Preserve cookie + Bearer + `X-Session-Token`; keep
  JSON `token` on login; keep body `access_token` on POST callback; temporarily
  still accept legacy `session` cookie with telemetry.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (PR 7 HTTP contracts exploration)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Explore PR 7 (canonical envelope + Zod + alias deprecation
  telemetry). Exploration only — no implementation.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both
- **Files Scanned**:
  - backend: `src/middleware/authMiddleware.ts`, `authorizeRoles.ts`,
    `validateRequest.ts`, `common/utils/safeLogging.ts`,
    `security/authorizationPolicies.ts`, `utils/responseBuilder.ts`,
    `controllers/authController.ts`, `server.ts`, `routes/authRoutes.ts`,
    `routes/paymentMethodRoutes.ts`, `docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md`
  - frontend: `src/api/http.ts`, `src/api/config.ts`,
    `src/common/contexts/UserContext.tsx`, `src/features/auth/Login.tsx`,
    `src/api/doulas/doulaService.ts`, `src/api/admin/adminService.ts`
- **Contract Findings**:
  - Canonical FE `ApiResponse`: `{ success: true, data }` /
    `{ success: false, error, code? }`. `normalizeError` prefers `error` then
    `message`.
  - `requestCanonical` requires boolean `success` on OK responses; login uses
    raw `fetch` and only reads `data.error` on failure — do not wrap login
    success in `{ success, data }` without FE change.
  - Auth middleware errors are `{ error }` (no `success: false`); safe 5xx often
    `{ success: false, error }`.
  - Default `VITE_USE_LEGACY_API` is off → most `get/post` use canonical parser;
    many services still use `fetchWithAuth` + `error.error || error.message`.
- **Drift Risk**: Adding `code` is safe additive; removing `error` string or
  forcing `success` wrapper on `/auth/login` / `/auth/me` / `/health` breaks FE.
  Alias Deprecation headers must not change JSON bodies.
- **Required Compatibility**: Preserve existing status codes and top-level
  `error` / `message` / `success` fields; additive `code` / `success: false`
  only; keep `/login` and `/client(s)` aliases live with telemetry.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (exploration-only)

## Preflight Update 2026-08-14 (PR 7 HTTP contracts)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Introduce canonical error codes + Zod validation
  incrementally; deprecation headers/telemetry on legacy aliases; preserve
  fields/status codes; no intake move (PR 8).
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both (reuse PR 7 exploration)
- **Contract Findings**: Login success stays `{ message, user, token }`;
  validation failures become
  `{ success: false, error, code: 'VALIDATION_ERROR', details? }` with string
  `error` preserved for UserContext. Alias JSON bodies unchanged;
  Deprecation/Sunset/Link headers additive.
- **Drift Risk**: Low if `error` string retained. FE may ignore new headers.
- **Required Compatibility**: Keep `/health`, `/auth/login`, `/auth/me`
  unwrapped success shapes; do not remove aliases.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (PR 8 intake characterization)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Characterize public request intake for PR 8 structural
  migration into `src/features/intake` (exploration only — no code move).
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (direction
  `architecture-assessment->backend`, not `frontend->backend`)
- **Repos Scanned**: both
- **Files Scanned**:
  - backend: `src/server.ts`, `src/routes/requestRoute.ts`,
    `src/controllers/requestFormController.ts`,
    `src/services/RequestFormService.ts`,
    `src/repositories/requestFormRepository.ts`,
    `src/intake/requestSubmissionDto.ts`, `src/constants/referralSource.ts`,
    `src/billing/expandedInsuranceBilling.ts`, `src/index.ts`,
    `src/__tests__/requestEndpoint.test.ts`,
    `src/__tests__/requestSubmissionFlow.test.ts`,
    `src/__tests__/requestSubmissionDto.test.ts`,
    `docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md`
  - frontend: `src/features/request/RequestForm.tsx`,
    `src/features/request/useRequestForm.ts`,
    `src/features/request/contexts/RequestFormContext.tsx`,
    `src/api/__tests__/requestSubmission.test.ts`, e2e helpers under
    `e2e/helpers/requestForm.ts`
- **Contract Findings**:
  - Public URL: `POST {apiBaseUrl}/requestService/requestSubmission` (no `/api`
    prefix, no auth).
  - FE success check: `response.ok && !responseData.error`; toast is FE-owned
    (`Request Form Submitted Successfully!`), not the BE message string.
  - BE happy path: `200 { message: "Form data received, onto processing" }` — no
    id/data payload.
  - BE validation/service failures: `400 { error: string }` (not canonical
    `{ success: false, … }` envelope).
  - FE also sends `skip_email_notifications` / `submission_source`; backend
    currently ignores both (emails always attempt after save).
- **Drift Risk**: Changing status codes, wrapping success in
  `{ success, data }`, renaming `error`/`message`, or requiring auth would break
  CRM submit. Returning client id is additive-safe if FE ignores unknown fields.
- **Required Compatibility**: Preserve public path, `200` + `{ message }`,
  `400` + `{ error }` string for PR 8 façade.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (characterization only)

## Preflight Update 2026-08-14 (PR 8 intake structural slice)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Migrate request intake into `src/features/intake` behind
  existing route/controller façade; domain validation/normalization; use case +
  ports; shadow-compare flag; preserve URL and response shapes.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
- **Repos Scanned**: both (reuse characterization)
- **Contract Findings**: Unchanged public contract. Legacy
  `src/intake/requestSubmissionDto.ts` becomes a re-export shim.
- **Drift Risk**: Low if normalize parity holds;
  `INTAKE_USE_FEATURE_PACKAGE=true` flips write path to use case.
- **Required Compatibility**: `POST /requestService/requestSubmission` →
  `200 { message: "Form data received, onto processing" }` / `400 { error }`.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (intake abuse protection)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Rate limit + idempotency + abuse protection on public
  `POST /requestService/requestSubmission`.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`
  (`no_open_handoff_tasks` for `frontend->backend`)
- **Repos Scanned**: both
- **Files Scanned**: BE `requestRoute.ts`, `requestFormController.createForm`,
  `intakeAbuseProtection.ts`; FE `RequestForm.tsx` (checks `ok && !error`; no
  Idempotency-Key today)
- **Contract Findings**: Happy path message unchanged. New
  `429 { error, code: RATE_LIMITED }` for rate limits (FE already toasts
  `error`). Honeypot bots get fake `200` success. Optional `Idempotency-Key`
  header; soft email dedupe covers double-submit without FE changes. Jest
  disables rate/soft-dedupe unless `INTAKE_ABUSE_ENFORCE=true`.
- **Drift Risk**: Legitimate multi-submit from same email within window may get
  soft-deduped 200 without a second lead (intentional).
- **Required Compatibility**: Preserve `200 { message }` success string; keep
  path public/unauthenticated.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (security summary doc)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Document P0 security completion + GCP encryption guidance
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: backend
- **Files Scanned**: handoff P0 checklist; existing
  `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`, `PRODUCTION_CLOUD_SQL_VERCEL.md`
- **Contract Findings**: Docs-only; no FE API change
- **Context Updated**: yes (`docs/SECURITY_P0_HARDENING_SUMMARY.md`)
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (PR to main — test gate + deploy)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Run automated tests and open a PR to `main` for Cloud Run
  deploy
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: backend CI (`test.yml`, `cloudbuild.yaml`)
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Document Cloud SQL/Cloud Run at-rest and in-transit
  encryption and how P0 ties into starting HIPAA
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: `SECURITY_P0_HARDENING_SUMMARY.md`; live `gcloud sql` /
  `gcloud run` describe (no secrets copied into docs)
- **Context Updated**: yes
- **Implementation Started After Gate**: n/a (docs only)

## Preflight Update 2026-08-14 (record FE P0 status in security summary)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Document frontend P0 as aligned-with-backend, Cloud Run host,
  not a finished security program
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both (user status + `SECURITY_P0_HARDENING_SUMMARY.md`,
  epic handoff)
- **Context Updated**: yes
- **Implementation Started After Gate**: n/a (docs only)

## Preflight Update 2026-08-14 (FE security medium closed — sync)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Record frontend medium-risk security closures against backend
  intake/auth contracts
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both (user report + BE `intakeAbuseProtection.ts`,
  `authController.handleToken`)
- **Contract Findings**: Honeypot field names match BE exactly. Fake 200 +
  `RATE_LIMITED`/`Retry-After`/`Idempotency-Key` header match. Body
  `access_token` still dual-supported on BE (`legacy.body_access_token`
  telemetry) — keep until unused.
- **Context Updated**: yes
- **Implementation Started After Gate**: n/a (sync only)

## Preflight Update 2026-08-14 (FE security P0 closed — sync)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Record frontend high-risk security closures against backend
  auth/intake contracts
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both (user report + BE intake/auth notes)
- **Contract Findings**: FE now trusts `/auth/me` for role; aligns with BE
  authoritative role. Intake no longer pretends it can skip emails. BE already
  has honeypot/rate-limit on submit; FE honeypot field still a medium follow-up.
- **Context Updated**: yes
- **Implementation Started After Gate**: n/a (sync only)

## Preflight Update 2026-08-14 (Account state dropdown blank)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Account State dropdown not showing saved state while
  city/address do
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both
- **Files Scanned**: FE `UpdateAccount.tsx`, `50States.tsx`; BE Cloud SQL
  `admins.state` for jerry@techluminateacademy.com
- **Contract Findings**: Backend returns `state: "Illinois"` correctly. UI bug:
  Select used `defaultValue` (not controlled after `/auth/me` reset) and
  SelectItem values were full names while form defaults used abbreviations.
- **Compatibility Assumptions**: Persist/display state as USPS codes (`IL`);
  accept legacy full names on read.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (admin first/last name split)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Account form spilling multi-word first name into last
  name after save
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both
- **Files Scanned**: FE `UpdateAccount.tsx`, `saveUser`; BE
  `cloudSqlTeamService.ts`, `userController.ts` `/users/update`, migration
  `add_admin_first_last_name.sql`
- **Contract Findings**: FE sends separate `firstname`/`lastname`. Admins
  previously only stored `full_name` and re-split on first whitespace on read →
  multi-word first names corrupted last name. Fix: persist
  `admins.first_name`/`last_name` and prefer those on read.
- **Compatibility Assumptions**: Account UI continues to use
  `user.firstname`/`user.lastname` from `/auth/me` and `/users/update` response;
  no FE contract change required.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-14 (admin role client portal)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Diagnose admin login landing on Client Portal for
  jerrybony5@gmail.com
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both
- **Files Scanned**: BE `resolveAuthoritativeRole.ts`, `supabaseAuthService.ts`;
  FE client portal screenshot / ProtectedRoutes
- **Contract Findings**: PR 6 ignores Supabase metadata for staff. User had
  `user_metadata`/`app_metadata` admin but no Cloud SQL `admins` row → defaulted
  to `client`. Added to `public.admins`.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-17 (HIPAA technical PHI inventory)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Read-only HIPAA PHI/data-flow inventory across backend +
  frontend (no application code changes)
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both
- **Files Scanned**: FE `src/features/request/useRequestForm.ts`,
  `src/api/dto/client.dto.ts`, `src/config/phi.ts`, `src/common/auth/roles.ts`,
  `src/Routes.tsx`, `src/common/contexts/UserContext.tsx`,
  `src/api/sessionAccessToken.ts`, `src/features/client-dashboard/`; BE
  `src/constants/phiFields.ts`, `src/security/authorizationPolicies.ts`,
  `src/controllers/clientController.ts`,
  `src/controllers/requestFormController.ts`,
  `src/repositories/requestFormRepository.ts`, `src/services/emailService.ts`,
  `src/services/customer/buildCustomerPayload.ts`,
  `src/utils/sensitiveAccess.ts`, `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`
- **Contract Findings**: Public intake schema in `useRequestForm.ts` matches
  Cloud SQL `phi_clients` insert in `requestFormRepository.ts`. Frontend
  `PHI_KEYS` treats name/email/phone as PHI; backend `PHI_FIELDS` /
  `ClientMapper` treat those as operational identifiers. Client portal vs staff
  CRM is frontend-routed (`StaffCrmRoute` / `ClientPortalRoute`) and
  backend-enforced via `/auth/me` roles.
- **Drift Risk**: Inventory is read-only. No API contract change.
- **Required Compatibility**: No implementation this task.
- **Context Updated**: yes
- **Implementation Started After Gate**: no (read-only)

## Preflight Update 2026-08-17 (mobile login session verification)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Production mobile login fails after success: "Signed in, but
  the session could not be verified"
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both
- **Files Scanned**: FE `UserContext.tsx`, `http.ts`, `sessionAccessToken.ts`,
  `Login.tsx`, `AuthCallback.tsx`, `config.ts`; BE `authController.ts`,
  `sessionCookies.ts`, `server.ts` CORS, `authMiddleware.ts`
- **Contract Findings**: Cookie-mode login `POST /auth/login` returns
  `{ message, user, token }` and `Set-Cookie: sb-access-token`. Frontend
  immediately calls `GET /auth/me` via `fetchWithAuth`. `getRequestAuth()`
  already sends `Authorization` + `X-Session-Token` from sessionStorage, but
  `login()` never stored the JSON token. Desktop still sends the cookie;
  Safari/Chrome on phones treat frontend (`*.run.app`) → API (`*.run.app`) as
  third-party and drop the cookie, so `/auth/me` returns 401.
- **Drift Risk**: Mobile login stays broken if frontend ships without storing
  `token`, or if backend stops returning JSON `token`.
- **Required Compatibility**: Keep JSON `token` on login; frontend must store it
  and send header auth on `/auth/me`. Cookie
  `SameSite=None; Secure; Partitioned` remains the desktop path.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-17 (deploy mobile session fix)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: PR + merge to `main` so Cloud Build deploys the mobile
  session verification fix (frontend token storage + backend partitioned
  cookies)
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: both (deploy path only)
- **Files Scanned**: BE `cloudbuild.yaml`; FE `frontend-crm/cloudbuild.yaml`
- **Contract Findings**: Unchanged from mobile login preflight. Frontend must
  ship for phones to work; backend `Partitioned` cookie is Chrome-only help.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-17 (frontend lint on mobile login PR)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix Prettier on `AuthCallback.tsx` and unused `accessToken`
  in `UserContext.updatePassword` (PR #80 lint)
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: frontend
- **Files Scanned**: `AuthCallback.tsx`, `UserContext.tsx`,
  `.github/workflows/lint.yaml`
- **Contract Findings**: No API change. Reset-password now stores `accessToken`
  for the same header-token fallback used at login.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-19 (Phase 1 network foundation verification)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Phase 1 only — verify Cloud SQL / Cloud Run network
  foundation (read-only; no infra mutations)
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: backend (infra/docs); frontend not relevant
- **Files Scanned**: `cloudbuild.yaml`, `src/db/cloudSqlPool.ts`,
  `docs/SECURITY_P0_HARDENING_SUMMARY.md`,
  `.cursor/skills/sokana-cloudsql-local-connect/SKILL.md`
- **Contract Findings**: No frontend impact
- **Live verification (2026-08-19)**: Cloud SQL private IP `10.109.240.3` on
  `default` VPC; PSA reserved `10.109.240.0/20`; public IP still on with ACL
  `189.60.28.42/32`; Cloud Run uses connector socket only (no Direct VPC yet)
- **Action**: No changes needed (verification only)
- **Context Updated**: yes
- **Implementation Started After Gate**: no

## Preflight Update 2026-08-30 (Enable native contracts locally)

- **Gate Result**: `run_preflight`
- **Task Intent**: Enable the existing native contract workflow in local
  development after validating its database and template prerequisites.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; the user explicitly
  requested this local contract-workflow action.
- **Files Scanned**:
  - `frontend-crm/src/common/utils/createContract.ts`
  - `frontend-crm/src/features/clients/components/dialog/EnhancedContractDialog.tsx`
  - `backend/src/routes/contractSigningRoutes.ts`
  - `backend/src/config/env.ts`
  - `backend/.env.example`
- **Contract Findings**: The CRM immediately calls the native compatibility
  endpoint, which returns 503 while `NATIVE_CONTRACTS_ENABLED` is false.
- **Drift Risk**: Enabling the route without the migration and active canonical
  PDF template will replace the clear 503 with a database or template failure.
- **Required Compatibility**: Keep outbox processing disabled for this local
  smoke test unless downstream email and billing side effects are intentional.
- **Action**: Context updated; validate prerequisites, enable only the local
  native-contract flag, restart the backend, and smoke-check health.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-19 (Phase 4 private IP production cutover)

- **Gate Result**: `run_preflight`
- **Task Intent**: Switch prod `CLOUD_SQL_HOST` to `10.109.240.3` + `require`
  TLS
- **Result**: Revision `sokana-private-api-00033-8wc`; `/health` 200; pool boot
  OK; connector kept for rollback; public IP unchanged
- **Docs**: `docs/CLOUD_SQL_NETWORK_HARDENING.md` Phase 4
- **Context Updated**: yes

## Preflight Update 2026-08-19 (Phase 3 private IP connectivity test)

- **Gate Result**: `run_preflight`
- **Task Intent**: TCP probe `10.109.240.3:5432` via Direct VPC; no prod DB
  change
- **Result**: Job `cloudsql-private-ip-probe-hx56n` TCP OK; no-VPC control timed
  out; production still on `/cloudsql/...`; `/health` 200
- **Docs**: `docs/CLOUD_SQL_NETWORK_HARDENING.md` Phase 3
- **Context Updated**: yes

## Preflight Update 2026-08-19 (Phase 2 Direct VPC egress)

- **Gate Result**: `run_preflight`
- **Task Intent**: Attach Direct VPC egress to `sokana-private-api`; keep
  connector
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Contract Findings**: No frontend/API contract change
- **Result**: Revision `sokana-private-api-00032-5wc`; network-interfaces on
  `default`/`default`; vpc-egress `private-ranges-only`; connector +
  `/cloudsql/` host unchanged; `/health` 200
- **Docs**: `docs/CLOUD_SQL_NETWORK_HARDENING.md`
- **Context Updated**: yes

## Preflight Update 2026-08-25 (Vercel retirement / CORS)

- **Gate Result**: `run_preflight`
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (unrelated; user
  override for Vercel retirement)
- **Task**: Remove Vercel origins from backend CORS; delete `vercel.json` both
  repos
- **Files Scanned**: `src/config/env.ts`, `src/server.ts`,
  `frontend-crm/src/api/http.ts`, `frontend-crm/src/config/env.ts`
- **Contract Findings**: Frontend uses `VITE_APP_BACKEND_URL` / Cloud Run API
  URL; CORS is backend-only. No frontend API contract change.
- **Drift Risk**: Low — production already on Cloud Run; removing Vercel CORS
  fallback does not affect approved origins when `FRONTEND_ORIGIN` is set on
  Cloud Run.
- **Required Compatibility**: Keep Cloud Run frontend URLs in `FRONTEND_ORIGIN`;
  localhost dev origins in non-production only.
- **Action**: Context updated; implementation started

## Preflight Update 2026-08-19 (Cloud SQL private IP / Direct VPC assessment)

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Assess whether Cloud SQL private IP + Cloud Run Direct VPC
  egress criteria are done (read-only; no API change)
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md`;
  `no_open_handoff_tasks` for `frontend->backend`
- **Repos Scanned**: backend (infra/docs); frontend not relevant
- **Files Scanned**: `cloudbuild.yaml`, `src/db/cloudSqlPool.ts`,
  `docs/SECURITY_P0_HARDENING_SUMMARY.md`,
  `docs/PILOT_JOURNEYS_AND_ROLLBACK.md`, `docs/PRODUCTION_CLOUD_SQL_VERCEL.md`,
  `.cursor/skills/sokana-cloudsql-local-connect/SKILL.md`
- **Contract Findings**: No frontend contract impact. Production DB path is
  Cloud Run unix socket `/cloudsql/...`, not a private IP host.
- **Drift Risk**: None for FE. If backend later switches `CLOUD_SQL_HOST` from
  `/cloudsql/...` to a private IP, FE is unaffected; Cloud Run env + SSL mode
  must change together.
- **Required Compatibility**: No changes needed
- **Action**: No changes needed (assessment only)
- **Context Updated**: yes
- **Implementation Started After Gate**: no

## Preflight Update 2026-08-19

- **Gate Result**: `run_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: Fix local client profile save — operational fields wrongly
  routed to `/clients/:id/phi`
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-10-backend-architecture-boundary-refactor.md` (unrelated;
  user-reported bug)
- **Repos Scanned**: backend + frontend
- **Files Scanned**:
  - `backend/src/constants/phiFields.ts` (PHI_FIELDS vs
    OPERATIONAL_UPDATE_COLUMNS, FIELD_ALIAS_MAP)
  - `backend/src/controllers/clientController.ts` (`updateClientPhi` validation)
  - `frontend-crm/src/config/phi.ts` (PHI_KEYS — redaction-only, too broad for
    save routing)
  - `frontend-crm/src/features/clients/components/dialog/LeadProfileModal.tsx`
    (save split)
  - `frontend-crm/src/common/utils/updateClient.ts` (strip list)
  - `frontend-crm/src/api/services/clients.service.ts` (`updateClientPhi`)
- **Contract Findings**: `PUT /clients/:id/phi` accepts only `PHI_FIELDS`
  (snake_case after normalize). Fields like `paymentMethod`, `pregnancyNumber`,
  `babyName`, `raceEthnicity`, `clientAgeRange`, `annualIncome`,
  `hasSecondaryInsurance` are operational/billing — must not go to `/phi`.
- **Drift Risk**: Frontend `PHI_KEYS` used for save routing caused 400 on
  `/phi`; operational fields were also stripped from `PUT /clients/:id` payload.
- **Required Compatibility**: Added `clientFieldRouting.ts` with backend-aligned
  split; updated LeadProfileModal, updateClient, updateClientPhi; expanded
  backend FIELD_ALIAS_MAP camelCase aliases.
- **Action**: Frontend routing fix + backend alias hardening
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-26 (Identity password-reset deployment)

- **Gate Result**: `run_preflight`
- **Task Intent**: Test and deploy frontend and backend after configuring the
  Identity Platform password-reset continuation to production Cloud Run login.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md` (user override for
  deployment).
- **Files Scanned**:
  - `frontend-crm/src/common/contexts/UserContext.tsx`
  - `frontend-crm/src/Routes.tsx`
  - `frontend-crm/cloudbuild.yaml`
- **Contract Findings**: Identity reset requests send Firebase
  `continueUrl=<VITE_APP_FRONTEND_URL>/login`; `/login` is a public frontend
  auth route. No backend request/response contract changed.
- **Drift Risk**: Cloud Build must supply the production frontend URL or the
  deployed app falls back to its own production origin. Existing reset emails
  retain the URL generated when requested.
- **Required Compatibility**: Keep the Cloud Run frontend domain authorized in
  Identity Platform and issue a new reset email after deployment.
- **Action**: Context updated; run both test suites, deploy both Cloud Run
  services, and verify health/routes.

## Preflight Update 2026-08-26 (Production Identity login IAM diagnosis)

- **Gate Result**: `run_preflight`
- **Task Intent**: Diagnose production `POST /auth/session` 401 after successful
  Firebase email/password authentication.
- **Files Scanned**:
  - `frontend-crm/src/common/contexts/UserContext.tsx`
  - `backend/src/services/identityPlatform/identityPlatformTokenService.ts`
- **Contract Findings**: The frontend sends the Firebase ID token to
  `/auth/session`; backend calls `verifyIdToken(idToken, true)`, whose
  revocation check requires `firebaseauth.users.get`.
- **Production Finding**: Cloud Run uses
  `sokana-private-storage-sa@sokana-private-data.iam.gserviceaccount.com`, which
  has Cloud SQL Client and Storage Object Admin only.
- **Drift Risk**: Deploying Identity mode without Firebase Auth IAM causes every
  production session exchange to fail with 401 despite valid browser login.
- **Required Compatibility**: Grant the runtime identity at least
  `roles/firebaseauth.viewer`; retain revocation checking.
- **Action**: Granted and verified `roles/firebaseauth.viewer` on the production
  Cloud Run service account. No code redeployment required.
- **Follow-up**: Dashboard API requests still returned 401 because Cloud Run
  lacked `AUTH_PROVIDER` and defaulted to Supabase. Updated production to
  `AUTH_PROVIDER=dual` and `IDENTITY_PLATFORM_PROJECT_ID=sokana-private-data`;
  revision `sokana-private-api-00060-466` serves 100% traffic and `/health` is
  OK.

## Preflight Update 2026-08-26 (Admin migration email resend)

- **Gate Result**: `run_preflight`
- **Task Intent**: Resend fresh production Identity Platform password-reset
  links to all four Cloud SQL administrators and record verification evidence.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; the approved resend
  advances the P0 Supabase-exit admin phase.
- **Files Scanned**:
  - `scripts/migrate-admin-auth-to-identity.ts`
  - `frontend-crm/src/common/contexts/UserContext.tsx`
  - `frontend-crm/src/features/auth/ResetPassword.tsx`
- **Contract Findings**: The migration script derives recipients only from Cloud
  SQL `public.admins`, generates Firebase reset links with a production `/login`
  continuation, and sends through the configured SMTP service.
- **Drift Risk**: Apply mode must explicitly use the production frontend URL;
  SMTP acceptance proves send submission but not inbox delivery or completion.
- **Required Compatibility**: Keep `AUTH_PROVIDER=dual`; do not include doulas
  or clients; retain Cloud SQL as the authoritative admin role source.
- **Action**: Context updated; implementation begins with production/cohort
  validation and a mandatory dry run.
- **Result**: Read-only completion check found 1 post-migration sign-in and 3
  pending admins. Apply mode skipped the completed admin and sent fresh
  production reset links to the other 3 (`reset_sent=3`, SMTP status 200).
  Production auth evidence confirms session, MFA, `/auth/me`, and dashboard
  success for the completed admin. The remaining 3 require recipient action.

## Preflight Update 2026-08-29 (Native Contract Module)

- **Gate Result**: `run_preflight`
- **Task Intent**: Replace SignNow for newly created contracts with a native,
  provider-neutral, single-client-signer backend module.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; the user explicitly
  prioritized the native contract implementation.
- **Files Scanned**:
  - `frontend-crm/src/common/utils/createContract.ts`
  - `frontend-crm/src/features/clients/components/dialog/EnhancedContractDialog.tsx`
  - `frontend-crm/src/features/client-dashboard/components/ClientContractsTab.tsx`
  - `frontend-crm/src/features/billing-portal/billingPortalApi.ts`
  - `frontend-crm/src/features/billing-portal/types.ts`
  - `frontend-crm/src/features/contracts/ContractRoutes.tsx`
  - `frontend-crm/src/pages/ContractSignedPage.tsx`
  - `frontend-crm/src/Routes.tsx`
  - `frontend-crm/src/api/http.ts`
- **Contract Findings**:
  - Active creation posts a flat payload to
    `POST /api/contract-signing/generate-contract`; a legacy helper can post a
    nested `contractData` payload.
  - Creation expects top-level `{ success, message, data }` and reads
    `data.contractId`; transitional `data.signNow` and `data.emailDelivery`
    fields remain in the TypeScript contract.
  - Billing contract endpoints require canonical `{ success, data }` responses
    and dollar-denominated amounts.
  - The unmounted client contracts tab accepts an array or `{ contracts }` and
    treats contract monetary values as cents.
  - Existing auth sends bearer and `X-Session-Token` credentials; admin and
    client role behavior must remain unchanged.
- **Drift Risk**: Removing the legacy creation envelope, changing monetary
  units, trusting a client-supplied client ID, or mounting `/me/contracts`
  behind the generic `/:id` route would break current frontend assumptions or
  ownership enforcement.
- **Required Compatibility**: Keep the legacy generate-contract route as a
  native adapter, accept both payload shapes, preserve billing/client units,
  mount client contract routes before generic client routes, and return only
  short-lived/protected document access.
- **Action**: Context updated; implementation starts with additive Cloud SQL
  schema and provider-neutral domain boundaries.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-30 (Guided contract creation and send)

- **Gate Result**: `run_preflight`
- **Task Intent**: Safely create and send a real native contract invitation,
  beginning with environment, client, billing-path, and side-effect validation.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; contract execution is
  awaiting an explicit environment/recipient choice before any side effect.
- **Files Scanned**:
  - `frontend-crm/src/common/utils/createContract.ts`
  - `frontend-crm/src/features/clients/components/dialog/EnhancedContractDialog.tsx`
  - `backend/src/routes/contractSigningRoutes.ts`
  - `backend/src/features/contracts/routes/adminContractRoutes.ts`
  - `backend/src/features/contracts/validation/schemas.ts`
  - `backend/docs/CONTRACT_TO_PORTAL_WORKFLOW.md`
- **Contract Findings**: The active CRM sends the selected Cloud SQL client ID
  and a flat pricing payload to authenticated
  `POST /api/contract-signing/generate-contract`. That compatibility endpoint
  creates and immediately sends the native contract; the canonical API supports
  separate `POST /api/contracts/drafts` and `POST /api/contracts/:id/send`.
- **Drift Risk**: Clicking the CRM send action is not a preview. It creates an
  immutable sent contract and emails an expiring signing invitation. Later
  signing may trigger outbox email and eligible self-pay invoice effects.
- **Required Compatibility**: Use the authoritative Cloud SQL client record and
  payment method, verify native-contract/outbox environment flags before send,
  and preserve the existing `{ success, message, data.contractId }` response.
- **Action**: Context updated; no contract will be created until the user
  confirms environment, recipient, and pricing/payment details.
- **Context Updated**: yes
- **Implementation Started After Gate**: no

## Preflight Update 2026-08-30 (Labor initials placement)

- **Gate Result**: `run_preflight`
- **Task Intent**: Move labor-contract initials fields so they do not obscure
  total, deposit, or balance values in the public signing view.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; the user explicitly
  prioritized correcting the active contract-signing flow.
- **Files Scanned**:
  - `frontend-crm/src/features/public-signing/SigningPdf.tsx`
  - `frontend-crm/src/features/public-signing/signingFields.ts`
  - `backend/scripts/seed-native-contract-templates.ts`
  - `backend/src/features/contracts/pdf/coordinates.ts`
  - `backend/src/features/contracts/pdf/fieldPreview.ts`
  - `backend/src/features/contracts/__tests__/laborSupportTemplateV2.test.ts`
- **Contract Findings**: Frontend overlays correctly apply normalized top-left
  coordinates. The active labor v4 manifest places all three initials boxes
  inside their corresponding financial snapshot boxes.
- **Drift Risk**: Mutating v4 would violate immutable template-version
  expectations and would not alter already-frozen sent contracts.
- **Required Compatibility**: Register a new active labor template version, keep
  v4 available for existing contracts, and assert that each initials box has a
  positive horizontal gap from its financial value.
- **Action**: Context updated; implementation starts with an additive v5 seed,
  coordinate tests, preview verification, and local template activation.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-30 (Initials beside rendered amounts)

- **Gate Result**: `run_preflight`
- **Task Intent**: Place labor-contract initials immediately after each rendered
  dollar amount instead of on top of the amount or trailing line text.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; user prioritized the
  active signing UI correction.
- **Files Scanned**:
  - `frontend-crm/src/features/public-signing/SigningPdf.tsx`
  - `frontend-crm/src/features/public-signing/signingFields.ts`
  - `backend/src/features/contracts/pdf/renderer.ts`
  - `backend/src/features/contracts/services/contractService.ts`
  - `backend/scripts/seed-native-contract-templates.ts`
- **Contract Findings**: Frontend overlays use frozen snapshot coordinates from
  contract creation. Fixed template v5 coordinates were too far right because
  snapshot amount boxes are wider than the rendered currency text.
- **Drift Risk**: Adjusting only the template would still fail for variable
  amounts; completion stamping must use the same per-contract coordinates as the
  signing UI.
- **Required Compatibility**: Compute initials placement from actual pricing at
  draft creation, persist it in `field_snapshot`, and reuse those coordinates
  when stamping the completed PDF.
- **Action**: Context updated; implementation started with dynamic placement
  helper, contract snapshot integration, and completion renderer merge.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-08-31 (upload contract templates to GCS)

- **Gate Result**: `run_preflight`
- **Task Intent**: Upload newly added local `templates/` PDFs/DOCX to GCS
  `contract-templates/` for admin Contracts page list/preview.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; user explicitly
  requested template storage upload.
- **Files Scanned**:
  - `backend/src/services/supabaseContractService.ts`
  - `backend/src/routes/contractTemplateRoutes.ts`
  - `backend/src/services/gcs/documentStorage.ts`
- **Contract Findings**: Admin Contracts page lists templates via
  `GET /contracts/templates`; storage paths are flat filenames under
  `contract-templates/` (e.g. `Labor Support Agreement.pdf`).
- **Drift Risk**: Low for list/preview; native signing still requires separate
  seed manifests in `contract_template_versions`.
- **Required Compatibility**: Keep flat filename keys so existing
  signed-url/download routes continue to work.
- **Action**:
  - [x] Context updated
  - [x] Implementation started

## Preflight Update 2026-08-31 (Post-signing success + emails)

- **Gate Result**: `run_preflight`
- **Task Intent**: After native contract signing, show a success page, email the
  client a signed PDF copy, and notify admin that the contract was signed.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; user prioritized the
  active signing completion UX.
- **Files Scanned**:
  - `frontend-crm/src/features/public-signing/PublicSigningPage.tsx`
  - `frontend-crm/src/pages/ContractSignedPage.tsx`
  - `backend/src/features/contracts/services/signingSessionService.ts`
  - `backend/src/features/contracts/repositories/signingSessionRepository.ts`
  - `backend/src/features/contracts/services/outboxService.ts`
  - `backend/src/services/emailService.ts`
- **Contract Findings**: Frontend already navigates to `/contract-signed` after
  `POST /signing/:token/complete`. Backend queues `signed_copy_email` on
  completion, but local dev had `CONTRACT_OUTBOX_ENABLED=false`, so emails were
  not being delivered.
- **Drift Risk**: Email delivery must not roll back a successful signature
  transaction; admin notification must remain separate from the client PDF copy.
- **Required Compatibility**: Keep completion response shape unchanged; send
  client PDF + admin notification synchronously when outbox is disabled, and via
  outbox when enabled in production.
- **Action**: Context updated; backend adds admin notification + synchronous
  local delivery fallback; frontend success page copy updated.
- **Context Updated**: yes
- **Implementation Started After Gate**: yes

## Preflight Update 2026-09-01 (automatic portal invite after eligibility)

- **Gate Result**: `run_preflight`
- **Task Intent**: Automatically email portal set-password invites when contract
  signing and billing-path payment readiness satisfy backend eligibility; no
  manual admin Invite click required.
- **Handoff inbox**: `open_handoff_tasks_found`:
  `2026-08-25-full-supabase-exit-launch-ready.md`,
  `2026-08-10-backend-architecture-boundary-refactor.md`; user requested
  automatic portal invite behavior.
- **Files Scanned**:
  - `frontend-crm/src/features/clients/components/portal-invite-modal.tsx`
  - `frontend-crm/src/lib/portalEligibility.ts`
  - `backend/src/services/portalEligibilityService.ts`
  - `backend/src/services/portalAutoInviteService.ts`
  - `backend/src/features/contracts/services/postSigningService.ts`
- **Contract Findings**: Frontend still exposes manual Invite for admins;
  backend now auto-sends invite on `portal_unlocked` using the same eligibility
  oracle (`signed` + deposit when self-pay + card when insurance/self-pay).
  Manual invite/resend endpoints unchanged.
- **Drift Risk**: FE eligibility heuristics may still differ from backend
  `client_onboarding_readiness`; admin UI should continue to trust API readiness
  fields over local `isPortalEligible()` when showing Invite state.
- **Required Compatibility**: Keep `POST /api/admin/clients/:id/portal/invite`
  and response shape; add no FE requirement for auto-invite (email is
  backend-only).
- **Action**:
  - [x] Context updated
  - [x] Implementation started
