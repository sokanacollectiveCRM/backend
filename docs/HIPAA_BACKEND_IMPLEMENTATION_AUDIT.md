# Sokana Collective Backend HIPAA/Security Implementation Audit

**Audit date:** 2026-09-04  
**Repository reviewed:** `sokanacollectiveCRM/backend` at commit
`dba44fb40ed964ad9e716ed1e47a503569311635`  
**Scope:** Read-only review of backend source, routes, middleware, services,
repositories, migrations, deployment files, and tests. No production systems,
vendor consoles, databases, logs, or infrastructure were inspected.  
**Status vocabulary:** DONE, PARTIAL, NOT DONE, NEEDS VERIFICATION, NOT
APPLICABLE.

## Executive summary

Sprint 1 closed the five enumerated P0 findings (six remediation tracks because
HIPAA-BE-003 covers both billing and insurance). Organization-wide invoices,
payments, reconciliation, reconciliation CSV, billing profiles, payment
schedules/history/status, and card-on-file routes now exclude doulas; doula
client responses are finance/insurance-minimized. Protected requests reject
server-resolved inactive accounts and refresh client portal disablement from
Cloud SQL. The legacy `self_pay_card_info` input is rejected without echoing its
value, normalized to `NULL` for retained-schema compatibility, and omitted from
active responses.

The supplied leadership update is corroborated by code for the narrow claims
about admin-only client CSV export, assignment checks, log containment,
minimized intake and assignment emails, removal of the simulated-payment route,
removal of the hardcoded SMTP password, and addition of regression tests. The
broader migration is not complete in current runtime code: Supabase remains an
active data/storage dependency for assignment authorization, dashboard client
data, doula-document metadata, legacy contract metadata/files, user enrichment,
and some legacy repositories.

### Backend controls confirmed complete

- Expired/invalid Supabase and Identity Platform tokens are rejected.
- Authorization roles are resolved from server-side Cloud SQL/app-managed
  records rather than user metadata.
- Client self-access paths resolve and enforce the authenticated client's Cloud
  SQL record.
- The all-client CSV route blocks client, doula, and billing roles.
- Public-intake and doula-assignment emails are reduced to opaque client number
  plus authenticated CRM link.
- Production request logging is metadata-only and production legacy console
  output is suppressed.
- The raw PAN/CVC simulated-payment route is absent and tested as unmounted.
- Payment-method submission accepts an Intuit token rather than PAN/CVC.
- QuickBooks card status normalization, end-of-expiration-month logic, fallback
  behavior, and legitimate-invoice idempotency are implemented and tested.
- QuickBooks webhooks have production-fail-closed HMAC validation and a
  database-backed duplicate-event claim ledger; QuickBooks also checks its
  optional timestamp header.
- SMTP credentials are read from environment variables; the formerly hardcoded
  test-script credential is gone.
- Client document bytes and native contracts use private GCS objects and
  short-lived signed URLs.
- Native contracts have actor/target/timestamp events and immutable PDF
  hash/generation evidence.

### Backend controls partially complete

- Authentication, authorization, contracts, documents, and dashboards are in a
  Cloud SQL/GCS migration state, not a completed Supabase-auth-only state.
- Assignment authorization and active CRUD use Cloud SQL. Assignment rows now
  retain active/completed/cancelled lifecycle state and end timestamps.
- Role enforcement does not match the confirmed billing, doula, development, and
  executive-director matrix.
- Notes, hours, and birth outcomes have assignment/ownership checks but lack
  complete creator, retention, version, and audit controls.
- Email minimization is strong for intake and assignment flows, but billing
  reminder endpoints accept arbitrary subject/body text and signed contract PDFs
  are sent through ordinary email.
- Document authorization exists, but doula metadata remains in Supabase, doula
  self-downloads are allowed, hard deletion exists, and download auditing is
  incomplete.
- Error handling is sanitized in some modern paths but legacy controllers still
  return raw error messages outside the production console guard.

### Immediate P0 findings closed by Sprint 1

- **HIPAA-BE-001 (DONE):** invoice listing is restricted to admin/billing.
- **HIPAA-BE-002 (DONE):** reconciliation JSON/CSV is restricted to
  admin/billing.
- **HIPAA-BE-003 (DONE):** doulas are excluded from billing, insurance, payment,
  and card-on-file routes and DTO fields.
- **HIPAA-BE-004 (DONE):** central authentication denies
  inactive/disabled/terminated accounts; client portal status is refreshed from
  Cloud SQL per request.
- **HIPAA-BE-005 (DONE):** `self_pay_card_info` writes are rejected, persistence
  is forced to `NULL`, and active responses omit the field.

### P1 items still open

- Any authenticated account can enumerate staff at `GET /auth/users` and
  retrieve arbitrary workforce profiles at `GET /users/:id`.
- Supabase remains an active client/assignment/document/contract data
  dependency.
- Note edits do not enforce original creator and notes lack
  soft-delete/versioning.
- Birth-outcome edits do not enforce original submitter/admin override
  attribution.
- Contract view/download policy is not implemented for billing, assigned doulas,
  clients, and executive directors as specified.
- QuickBooks OAuth initiation is app-public when the feature is mounted.
- Clinical-PHI email prevention is not enforced for arbitrary billing reminder
  text.
- Sensitive access and document downloads lack a comprehensive audit trail.

### Controls requiring production/infrastructure verification

- Actual `AUTH_PROVIDER` cutover, Supabase shutdown, data/document transfer,
  reconciliation, and residual Supabase records.
- GCS bucket public-access prevention, IAM, retention/versioning, CMEK, access
  logs, malware scanning, and lifecycle policies.
- Cloud Run ingress/authentication, VPC/private Cloud SQL connectivity, TLS
  mode, Cloud SQL IAM/least-privilege, backups, PITR, and the one-hour recovery
  target.
- Secret Manager bindings and secret rotation in the deployed revision.
- Production webhook secrets, provider configuration, and runtime event-ledger
  migration.
- Vercel project deletion, subscription cancellation, and refund.

### Controls requiring leadership/legal/vendor confirmation

- BAAs/contract terms for Google Cloud, Supabase during transition,
  CloudConvert, Intuit/QuickBooks, and the email provider.
- Formal risk assessment, policies, staff training evidence, incident-response
  procedures, access reviews, retention rules, and legal/compliance review.

## Method and scoring

Implementation was marked DONE only when an active runtime path enforces the
control and implementation or test evidence supports it. Comments, status
documents, and the supplied leadership update were not treated as proof of
deployed behavior. NEEDS VERIFICATION means source code cannot establish the
operational fact. Severity is remediation priority, not a legal conclusion.

## 1. Authentication architecture

| Control                          | Status  | Evidence                                                                                                                                                                                                                                                                                    | Gap                                                                                                                                                                                        |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current provider/cutover         | PARTIAL | `src/config/env.ts` `authProvider.mode`; `src/middleware/authMiddleware.ts`; `src/services/identityPlatform/identityPlatformTokenService.ts`; `src/services/identityPlatform/cloudSqlIdentityUserService.ts`; `src/services/supabaseAuthService.ts`                                         | Identity Platform tokens now resolve application identity, role, and lifecycle state only from Cloud SQL. Supabase remains the default and dual mode still accepts legacy Supabase tokens. |
| Token validation                 | DONE    | `authMiddleware`; `IdentityPlatformTokenService.verifyIdToken(idToken, true)`; `supabase.auth.getUser(token)`                                                                                                                                                                               | Runtime key/provider configuration still requires deployment evidence.                                                                                                                     |
| Trusted authorization role       | DONE    | `src/security/resolveAuthoritativeRole.ts`; `src/services/identityPlatform/cloudSqlIdentityUserService.ts`                                                                                                                                                                                  | Identity Platform uses only Cloud SQL roles. App-managed `public.users.role` remains accepted only on the legacy Supabase-auth path during transition.                                     |
| User metadata cannot grant roles | DONE    | `resolveAuthoritativeRole` ignores `user_metadata`/`app_metadata`; `authCompatibility.test.ts`                                                                                                                                                                                              | None found in the reviewed authorization resolver.                                                                                                                                         |
| Disabled staff denied            | DONE    | `authMiddleware`; `security/accountAccess.ts`; both token loaders resolve app-managed state per request                                                                                                                                                                                     | Client portal disablement is additionally refreshed directly from Cloud SQL.                                                                                                               |
| Expired session denied           | DONE    | Provider token verification in `authMiddleware`; revoked-token check for Identity Platform                                                                                                                                                                                                  | No independent inactivity clock.                                                                                                                                                           |
| Refresh/logout/revocation        | PARTIAL | HTTP-only one-hour cookie in `src/security/sessionCookies.ts`; provider validation each request; `SupabaseAuthService.logout`                                                                                                                                                               | Header/Bearer tokens bypass cookie age; logout does not prove per-token revocation; shared server-side sign-out semantics are unclear.                                                     |
| Supabase authentication-only     | PARTIAL | Cloud SQL is primary in `src/index.ts`; assignment authorization/CRUD and Identity Platform profile/role resolution are Cloud SQL-only, but `DoulaDocumentRepository`, `SupabaseContractService`, `dashboardRoutes.ts`, and the legacy Supabase-auth `SupabaseUserRepository` remain active | Runtime code can still read/write dashboard, document, contract, and legacy-auth user data in Supabase.                                                                                    |

Active Supabase PHI/client-related access is proven by code, not inferred:
`dashboardRoutes.ts` queries `clients`, `client_info`, `notes`, and
`payment_tracking`; `SupabaseContractService.createContract/fetchContractPDF`
uses Supabase tables/storage; `RequestFormRepository` retains a Supabase client
while writing Cloud SQL; and `SupabaseUserRepository` contains reachable legacy
`client_info` mutations on the Supabase-auth compatibility path. Identity
Platform request identity and activity creator-name enrichment no longer read
Supabase user/auth metadata.

## 2. Role-based access control

Runtime roles are `admin`, `billing`, `doula`, and `client`
(`src/security/resolveAuthoritativeRole.ts`). There are no distinct
`executive_director`, `finance`, `insurance_biller`, `development`,
`grant_writer`, or support roles. An executive director can only be represented
as `admin`; development/grant-writer access cannot be expressed.

| Resource                       | Admin                            | Billing                              | Doula                                    | Client                                                             | Status                       |
| ------------------------------ | -------------------------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| Client demographics/clinical   | Broad                            | Route-excluded                       | Assigned through mixed assignment source | Own                                                                | PARTIAL                      |
| Intake records                 | All via admin request APIs       | None                                 | None                                     | Authenticated request ownership is unclear for legacy request APIs | PARTIAL                      |
| Notes                          | All                              | Excluded                             | Assigned                                 | Own client-visible only                                            | PARTIAL                      |
| Birth outcomes                 | View/manage                      | Excluded                             | Assigned                                 | Own through generic detail                                         | PARTIAL                      |
| Assignments                    | Manage                           | None                                 | Own/assigned reads                       | Own assigned-doula read                                            | PARTIAL                      |
| Contracts                      | Generate/download in native path | List/view/download                   | No assigned-client contract route        | Own native view/download                                           | PARTIAL                      |
| Client documents               | Broad signed URL                 | None, even for insurance docs        | Assigned signed URL                      | Own upload/list/download/delete                                    | PARTIAL                      |
| Payment schedules/installments | Manage                           | Manage                               | Excluded from dedicated schedule route   | No dedicated own schedule route shown                              | PARTIAL                      |
| Invoices                       | All                              | Organization-wide list               | None                                     | No own invoice route                                               | DONE                         |
| Billing/insurance profile      | Broad                            | Read/write for billing work          | None                                     | Own read/write                                                     | DONE                         |
| Card-on-file API               | Any client                       | Any client for billing work          | None                                     | Own                                                                | DONE                         |
| Reports/exports                | All                              | Reconciliation/export                | None                                     | None                                                               | DONE for P0 financial routes |
| User administration/directory  | Admin mutations                  | Directory readable via `/auth/users` | Directory readable via `/auth/users`     | Directory readable via `/auth/users`                               | NOT DONE                     |

## 3. Record-level authorization / BOLA / IDOR

| Route                                                        | Role Check         | Record-Level Check                                                 | Status   | Evidence                                                                                                     |
| ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /clients/:id` and aliases                               | admin/doula/client | Client ownership; doula Supabase assignment                        | PARTIAL  | `clientRoutes.ts`; `ClientController.getClientById`; `canAccessSensitive`                                    |
| `PUT/PATCH /clients/:id`                                     | admin/doula/client | Client ownership; doula Supabase assignment                        | PARTIAL  | `ClientController.updateClient`; update whitelist tests                                                      |
| `PUT /clients/:id/phi`                                       | admin/doula        | Supabase assignment for doula                                      | PARTIAL  | `updateClientPhi`; `phiBrokerService.ts`                                                                     |
| `GET /clients/:id/activities`                                | admin/doula/client | Client ownership; doula assignment; client visibility filter       | PARTIAL  | `getClientActivities`; `ActivityMapper.isVisibleToClientMetadata`                                            |
| `POST /clients/:id/activity`                                 | admin/doula        | Doula assignment                                                   | PARTIAL  | `createActivity`                                                                                             |
| `PATCH /api/doulas/clients/:clientId/activities/:activityId` | doula              | Cloud SQL assignment and activity/client match; no creator check   | NOT DONE | `DoulaController.patchClientActivity`; `CloudSqlActivityRepository.updateActivityMetadataMerge`              |
| `PUT /clients/:id/birth-outcomes`                            | admin/doula        | Supabase assignment; no submitter check                            | PARTIAL  | `updateClientBirthOutcomes`                                                                                  |
| `POST /api/doulas/hours`                                     | doula              | Authenticated doula ID and Cloud SQL assignment                    | DONE     | `DoulaController.logHours`; `hourEndpoints.test.ts`                                                          |
| `POST /users/:id/addhours`                                   | admin/doula        | Doula self-ID and Supabase assignment                              | PARTIAL  | `UserController.addNewHours`; `addHoursAuthorization.test.ts`                                                |
| `PATCH /api/doulas/hours/:hourId`                            | admin/doula        | Repository constrains doula ownership; no current assignment check | PARTIAL  | `DoulaController.updateHour`; hours repository                                                               |
| Client document `/me/*` routes                               | client             | Auth user resolves own Cloud SQL client; document/client match     | DONE     | `clientRoutes.ts`; `ClientController.getMyDocumentUrl/deleteMyDocument`; `clientDocumentsController.test.ts` |
| `GET /clients/:clientId/documents*`                          | admin/doula        | Doula Supabase assignment and document/client match                | PARTIAL  | `authorizeStaffClientDocumentAccess`; `ClientDocumentRepository`                                             |
| `GET /api/clients/me/contracts/:id*`                         | client             | Repository/service client constraint                               | DONE     | native `clientContractRoutes.ts`; `ContractController.getMine/downloadMine`                                  |
| `GET /api/billing/contracts/:id*`                            | admin/billing      | Contract exists; no per-record restriction needed for billing role | PARTIAL  | `billingRoutes.ts`; limited billing DTO service; download-policy mismatch                                    |
| `GET /clients/:clientId/billing/payment-schedule`            | admin/billing      | Client ID joins schedules/contracts                                | DONE     | `clientBillingController.ts`; `installmentInvoiceService.ts`                                                 |
| `GET/PUT /clients/:id/billing`                               | admin/doula        | Assigned doula check                                               | NOT DONE | Doula role itself violates policy; `ensureBillingAccess`                                                     |
| `GET/POST /api/payment-methods/:clientId`                    | admin/doula/client | Client own or Cloud SQL assigned doula                             | NOT DONE | `paymentMethodRoutes.ts`; `PaymentMethodController`                                                          |
| `GET /api/invoices`                                          | admin/doula        | None; returns up to 1,000 organization-wide invoices               | NOT DONE | `invoiceRoutes.ts`; `listInvoicesFromCloudSql`                                                               |
| `GET /api/financial/reconciliation[.csv]`                    | admin/doula        | None; organization-wide                                            | NOT DONE | `financialRoutes.ts`; `reconciliationService.ts`                                                             |
| `GET /auth/users`                                            | any authenticated  | None                                                               | NOT DONE | `authRoutes.ts`; `AuthController.getAllUsers`                                                                |
| `GET /users/:id`                                             | any authenticated  | None                                                               | NOT DONE | `specificUserRoutes.ts`; corresponding user controller                                                       |
| `GET /clients/fetchCSV`                                      | admin              | Bulk endpoint intentionally admin-only                             | DONE     | `clientRoutes.ts`; `ClientUseCase.exportCSV`; `clientCsvExportAuth.test.ts`                                  |

Client A is blocked from Client B on reviewed client detail, note-read,
document, and native contract paths. An unassigned doula is blocked on reviewed
client/PHI/notes/document/hour paths, but the decision is inconsistent because
generic paths use Supabase assignment rows while direct doula paths use Cloud
SQL. Billing is excluded from clinical routes. An inactive doula is not globally
denied. Every direct cross-record exposure above is classified in the findings
section.

## 4. Doula assignment authorization

**Status: DONE for active assignment authorization and CRUD.** Cloud SQL
`public.doula_assignments` is the shared source for direct doula flows,
`canAccessSensitive`, and generic `/clients/*` authorization. The lifecycle
migration adds active/completed/cancelled status and end timestamps;
unassignment soft-revokes and all access checks require active status. Evidence:
`src/utils/sensitiveAccess.ts`,
`src/services/cloudSqlDoulaAssignmentService.ts`,
`src/db/migrations/20260906_harden_doula_assignment_lifecycle.sql`,
`src/__tests__/cloudSqlSensitiveAccess.test.ts`,
`src/controllers/clientController.ts`, `src/controllers/doulaController.ts`.

## 5. Service-hours authorization

**Status: PARTIAL.** `/api/doulas/hours` derives the doula from `req.user` and
verifies the client in the authenticated doula's Cloud SQL list. The legacy
`/users/:id/addhours` rejects clients/billing, requires the doula path/body IDs
to match the authenticated doula, and checks an assignment, but uses Supabase
assignment state and only rejects a non-approved `account_status` when that
field is present. Updates constrain the row to the doula owner but do not
re-check a current assignment; no DELETE hours route was found. Admin management
rules are not documented in code. Evidence: `doulaRoutes.ts`,
`DoulaController.logHours/updateHour/getMyHours`, `specificUserRoutes.ts`,
`UserController.addNewHours`, `SupabaseUserRepository.addNewHours`,
`addHoursAuthorization.test.ts`, `hourEndpoints.test.ts`.

## 6. Notes authorization

**Status: PARTIAL.** Creation/read are restricted to admin or assigned doula;
clients see only `visibleToClient` metadata. A doula editing portal visibility
must still be assigned and the activity must belong to the specified client.
However, the update query does not require `created_by = actor`, so a different
assigned doula can edit visibility. There is no note DELETE route, but the
database model has no explicit soft-delete, immutable version history, or note
audit events. Evidence: `clientRoutes.ts`, `doulaRoutes.ts`,
`ClientController.createActivity/getClientActivities`,
`DoulaController.patchClientActivity`, `CloudSqlActivityRepository`.

## 7. Birth outcomes authorization

**Status: PARTIAL.** Admin and an assigned doula may write structured,
allowlisted fields; billing and client roles cannot call the write route.
Authorized generic detail returns outcomes to admin, assigned doula, or the
client themself. The row does not store original submitter/updater, and edits do
not restrict an assigned doula to the original submitter or record an approved
admin override. The grant-writer role is absent. Evidence: `clientRoutes.ts`,
`ClientController.updateClientBirthOutcomes/getClientById`,
`CloudSqlClientRepository.updateClientOperational`, migration
`add_phi_clients_birth_outcomes_structured.sql`,
`clientBirthOutcomesAuth.test.ts`, `clientBirthOutcomesEndpoint.test.ts`.

## 8. Export authorization

**Status: PARTIAL.** `GET /clients/fetchCSV` is admin-only and blocks
client/doula/billing roles, closing the prior client bulk-export defect. The
exact organization rule is not represented: finance and development cannot
receive the intended client/address/income exports, development and grant-writer
roles do not exist, and there is no clinical-export distinction. Worse, doulas
may export all reconciliation data at `GET /api/financial/reconciliation/csv`.
Evidence: `clientRoutes.ts`, `security/authorizationPolicies.ts`,
`ClientUseCase.exportCSV`, `financialRoutes.ts`, `clientCsvExportAuth.test.ts`,
`clientCsvFullExport.test.ts`.

## 9. Clinical PHI in email

| Email Flow                         | PHI in Subject?                        | PHI in Body?                                                      | Status   | Evidence                                                                                                   |
| ---------------------------------- | -------------------------------------- | ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Public intake staff notification   | No                                     | No; client number + CRM link                                      | DONE     | `intakeStaffNotificationEmail.ts`; `RequestFormController.createForm`; test                                |
| Intake submitter confirmation      | No                                     | No submitted fields                                               | DONE     | Same files/test                                                                                            |
| Doula assignment notification      | No                                     | No; client number + CRM link                                      | DONE     | `doulaAssignmentNotificationEmail.ts`; `NodemailerService.sendDoulaMatchNotification`; test                |
| Client match notification          | No clinical detail                     | Client/doula identity and contact                                 | DONE     | `NodemailerService.sendClientMatchNotification`                                                            |
| Team/doula/client portal invites   | No clinical detail                     | Identity, role, and invitation link                               | DONE     | `emailService.ts` invite methods                                                                           |
| Native contract signing invitation | Service/contract title may appear      | Name, contract title, expiring signing URL                        | PARTIAL  | `sendNativeContractInvitation`                                                                             |
| Signed contract copy               | Contract title                         | Full signed PDF attached                                          | PARTIAL  | `sendSignedContractCopy`; completion service                                                               |
| Billing contract initiation        | No client name in subject              | Name, service/contract type, total/deposit/installments, CRM link | PARTIAL  | `sendContractInitiatedBillingEmail`                                                                        |
| Invoice/installment email          | Invoice number/status                  | Name, amount, due date, link/PDF                                  | PARTIAL  | `sendInvoiceEmail.ts`; `installmentInvoiceService.ts`                                                      |
| Billing reminder                   | Contract type/payment issue can appear | Name, amount, due date, issue                                     | PARTIAL  | `billingReminderService.ts`                                                                                |
| Custom billing reminder input      | Caller-controlled                      | Caller-controlled                                                 | NOT DONE | `billingRoutes.ts` accepts `subject` and `message`; service sends them without clinical-PHI classification |
| Identity email MFA                 | No PHI                                 | One-time code only                                                | DONE     | `EmailMfaChallengeService.startChallenge`                                                                  |

INV-01 is closed: no full intake payload is sent by the active public intake
controller. Overall email control remains PARTIAL because ordinary-email content
policy is not centrally enforced, custom billing text is unrestricted, and
signed contracts are attached through SMTP.

## 10. Secrets and credential handling

**Status: DONE for source containment; NEEDS VERIFICATION for deployed secret
storage.** `src/scripts/sendTestEmail.ts` now loads `EMAIL_PASSWORD` from
environment and fails closed when missing. `NodemailerService` does the same. A
value-suppressing scan found no apparent hardcoded production credential
assignment in source/scripts; flagged literals were confined to security test
fixtures. `.env.example` is tracked, not a populated `.env`.
`smtpCredentialContainment.test.ts` passes. `PRODUCTION_READINESS.md` recommends
Secret Manager, but `cloudbuild.yaml` does not prove deployed secret bindings or
rotation. No secret value was printed or included in this report.

## 11. Payment-card handling

**Status: PARTIAL.** The mounted payment-method POST schema accepts only UUID
`client_id`, `intuit_token`, and `request_id`. QuickBooks responses are
normalized to masked metadata; the simulated PAN/CVC route and legacy handlers
are absent. However, `ClientController.validateBillingPayload`,
`RequestFormRepository.normalizeBillingFields`, `CloudSqlClientRepository`, and
DTOs accept/persist/return arbitrary `self_pay_card_info` text with no PAN/CVC
detection or migration constraint. Doulas can also read/write this billing field
and access card-on-file endpoints. Evidence: `paymentMethodRoutes.ts`,
`customerPaymentMethodService.ts`, `cloudSqlPaymentMethodRepository.ts`,
`simulatePaymentRouteDisabled.test.ts`, `customerPaymentMethodStatus.test.ts`,
`clientController.ts`, `types.ts`.

## 12. QuickBooks billing security

**Status: DONE for the specified invoice/card mechanics; PARTIAL overall because
of RBAC.** `CustomerPaymentMethodService` treats QuickBooks Payments as
authoritative, maps `active/missing/expired/inactive/not_required`, evaluates
expiration through the last day of the month, and uses a local masked fallback
on provider outage. `InstallmentInvoiceService` creates only the real
installment invoice, uses a database transaction/advisory lock, sends
`installment-${installmentId}` as provider idempotency, persists the provider
invoice before email, records email failure, and reuses the existing invoice on
retry. Portal readiness consumes normalized card status. No $1 verification
charge is created; historical verification IDs are reconciliation-only. Tests:
`customerPaymentMethodStatus.test.ts`, `installmentInvoiceService.test.ts`,
`portalEligibilityComputation.test.ts`,
`quickbooksInvoiceWebhookService.test.ts`,
`quickBooksTokenRefreshSafety.test.ts`. RBAC defects are HIPAA-BE-001 through
-003 and -005.

## 13. Contract / native signing backend security

**Status: PARTIAL.** Native draft/send/void/audit/download is admin-only; native
client routes constrain contracts to the authenticated client's Cloud SQL ID.
Billing gets limited DTOs but also inline bytes and signed download URLs. There
is no assigned-doula contract view. Client download exists even though the
confirmed policy reserves downloads for executive directors, and no distinct
executive-director role exists. SignNow and DocuSign adapters have been removed.
Native signed files live in GCS with hash/generation evidence. Evidence: native
contract feature and tests.

## 14. CloudConvert exposure

**Status: PARTIAL; vendor terms NEEDS VERIFICATION.** CloudConvert is in an
active admin route: `POST /contracts/templates/generate` (and
`/api/contracts/...`) calls `ContractController.generateTemplate` →
`ContractUseCase.generateTemplate` → `SupabaseContractService.generateTemplate`
→ `convertToPdf`. The filled DOCX buffer, potentially containing all
caller-supplied contract fields, is uploaded to CloudConvert and the converted
PDF is downloaded from its export URL. Native contracts do not use this path.
Whether the feature is used in production and whether an appropriate
agreement/BAA exists cannot be established from code. Evidence:
`contractTemplateRoutes.ts`, `supabaseContractService.ts`,
`utils/convertToPdf.ts`.

## 15. Secure document storage

**Status: PARTIAL.** Client document bytes, doula document bytes, native
contracts, and templates use the private GCS API wrapper and time-limited signed
URLs. Client document metadata is in Cloud SQL with own-client/document checks.
Native contracts are in Cloud SQL/GCS. Gaps: doula document metadata remains in
Supabase; the legacy contract service writes contract metadata and PDFs to
Supabase; doulas receive signed URLs for their uploaded documents although the
stated direction says upload without download; client and doula document
deletion is permanent; download events are generally not audited; object
IAM/public status, retention, versioning, scanning, and lifecycle cannot be
proven. Evidence: `documentStorage.ts`, upload
services/repositories/controllers, `SupabaseContractService`, native contract
composition, document tests.

## 16. Audit logging

| Action                          | Audit Event Exists? | Actor                                      | Target             | Timestamp                    | Sensitive Data Excluded?                                                         |
| ------------------------------- | ------------------- | ------------------------------------------ | ------------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| Login/auth success              | PARTIAL             | Transport/context only                     | Route              | Log timestamp                | Yes in structured logger                                                         |
| Failed auth/access              | DONE                | User ID/role when known                    | Route/method       | Log timestamp                | Yes; allowlisted metadata                                                        |
| Client record read              | NOT DONE            | No durable event                           | No                 | No                           | NOT APPLICABLE                                                                   |
| Client edit/PHI edit            | PARTIAL             | Operational log context                    | Client ID          | Log timestamp                | Values excluded, but keys/IDs logged                                             |
| Notes create/update             | NOT DONE            | Creator stored on row only                 | Client/activity    | Row timestamp only           | Content is stored as record, not audit event                                     |
| Birth outcomes                  | NOT DONE            | No submitter/updater                       | Client             | Generic row update timestamp | No separate event                                                                |
| Hours                           | PARTIAL             | Doula ID in row                            | Client/hour        | Row timestamp                | No immutable event                                                               |
| Assignment                      | PARTIAL             | Admin route identity available             | Client/doula row   | Row timestamps               | No durable complete event ledger                                                 |
| Native contracts                | DONE                | Actor type/ID                              | Contract/client    | `occurred_at`                | Event payload designed for metadata                                              |
| Historical vendor e-sign rows   | PARTIAL             | Some generated-by/mapping                  | Contract           | Row timestamps               | No complete event trail                                                          |
| Document upload/download/delete | PARTIAL             | Some controller structured logs            | Document IDs       | Log timestamp                | Downloads not durably audited                                                    |
| Billing reminders               | DONE                | Sender ID/role                             | Contract/recipient | `sent_at`                    | No clinical fields, but entire message/subject and recipient email are persisted |
| Invoices/card decisions         | PARTIAL             | Generated-by/system source                 | Client/installment | Event/row timestamps         | Masked status only; not all reads/actions audited                                |
| User/account/permission changes | NOT DONE            | No comprehensive immutable event           | Account            | No                           | No durable audit ledger found                                                    |
| Exports                         | PARTIAL             | Authorization denial and HTTP request logs | Route              | Log timestamp                | No durable successful-export event                                               |
| Security incidents              | NOT DONE            | No incident model                          | No                 | No                           | No                                                                               |

Overall audit logging is PARTIAL: contract and onboarding/billing event ledgers
exist, but sensitive record reads, most writes, exports, account changes,
document downloads, and security incidents are not comprehensively recorded.

## 17. Sensitive application logging

**Status: DONE for production containment; PARTIAL across non-production/legacy
code.** `createSafeRequestLogger` records route templates rather than
URLs/query/body; Pino uses an allowlist and redaction;
`installProductionConsoleGuard` replaces legacy console methods in production.
`securityLogging.test.ts` proves selected PHI, tokens, cookies, payment links,
and provider payloads do not appear. Legacy code still passes error objects,
client IDs, dynamic key names, contract structures, and provider error messages
to `console.*` in `clientController.ts`, `doulaController.ts`,
`contractController.ts`, `contractProcessor.ts`, `convertToPdf.ts`,
`quickbooksController.ts`, `tokenUtils.ts`, `portalController.ts`, and payment
services. Those arguments can appear in development/test logs and should be
migrated to the safe logger.

## 18. Session timeout / inactivity

**Status: PARTIAL.** The browser cookie has a one-hour absolute `maxAge`, is
HTTP-only, secure in production, and SameSite/partitioned. Protected APIs
validate provider token expiration. There is no server-side last-activity store,
rolling inactivity enforcement, warning mechanism, or centralized revocation
record. A still-valid Bearer or `X-Session-Token` can call the API after the
cookie expires. Frontend warning behavior is outside backend scope. Evidence:
`sessionCookies.ts`, `authMiddleware.ts`.

## 19. Account lifecycle

**Status: NOT DONE for immediate staff termination enforcement; NEEDS
VERIFICATION for scheduled governance.** Admin routes can create/update/delete
Cloud SQL team records and disable client portal status, but authentication does
not check staff `account_status` or client `portal_status` per request and does
not revoke provider tokens. No reliable last-login update, 90-day dormant review
job, six-month access-review report, shared-account detection, or durable
permission-change audit was found. Unique provider UIDs exist, but operational
no-shared-account practice cannot be proven. Evidence: `adminRoutes.ts`,
`userController.ts`, `CloudSqlTeamService`, `PortalInviteService`,
`resolveAuthoritativeRole.ts`, `authMiddleware.ts`.

## 20. MFA

**Status: PARTIAL (governance hardening, not automatically a defect).** Identity
Platform staff login has an email OTP challenge, expiration, retry/resend
limits, encrypted challenge material, and tests. It is not a provider-native
second factor, clients are excluded, and `/auth/login` remains a direct Supabase
password path that does not require the OTP. Enforcement therefore depends on
disabling the Supabase path and setting `AUTH_PROVIDER`; deployment cannot be
verified. Evidence: `authRoutes.ts`,
`AuthController.startIdentitySession/verifyIdentityMfa`,
`EmailMfaChallengeService`, `mfaCrypto.test.ts`.

## 21. Database / Cloud SQL security evidence visible from code

**Status: PARTIAL with infrastructure NEEDS VERIFICATION.** `cloudSqlPool.ts`
uses a bounded shared `pg.Pool`, environment credentials, timeouts, retry
handling, and parameterized queries in reviewed repositories. Production TCP
defaults to TLS, but `CLOUD_SQL_SSLMODE=require` sets
`rejectUnauthorized:false`; Unix sockets disable TLS as expected for a local
Cloud SQL connector. `cloudbuild.yaml` deploys Cloud Run but does not specify
Cloud SQL attachment, VPC connector, ingress, service account, secret bindings,
or database IAM. `deploy.sh` uses `--no-allow-unauthenticated`, but that script
is not proof of current service state. Private IP, firewall, backups/PITR, IAM,
certificate verification, and least-privilege grants require production
evidence.

## 22. Data integrity

**Status: PARTIAL.** Strong controls exist for invoice generation and payment
schedules: transactions, row/advisory locks, provider idempotency, unique
provider IDs, and failure-state persistence. Native contracts use database
transactions, state machines, immutable snapshots/hashes/generations,
invitation/session state, outbox leasing, and events. Webhooks and intake use
unique ledgers. Gaps: assignments are hard-deleted and lack status history;
notes have no version/creator-guarded edits; hours lack current-assignment
revalidation/version events; birth outcomes have no author/updater attribution
or versioning; legacy contract workflows are less transactional. Evidence:
`installmentInvoiceService.ts`, `cloudSqlPaymentScheduleService.ts`, contract
feature repositories/services/migrations, `webhookEventStore.ts`, intake abuse
migration, activity/assignment/hour repositories.

## 23. Backup/disaster-recovery code support

**Status: NEEDS VERIFICATION.** `/health` proves process availability only and
does not test DB/vendor dependencies. `scripts/backup-before-reset.sh` creates a
directory and prints manual export instructions; it does not execute a verified
backup or restore. Migration checklists and rollback documentation exist, but no
automated restore test or measured recovery workflow proves the approximately
one-hour target. Cloud SQL backup/PITR and GCS recovery settings are
infrastructure facts not visible here.

## 24. Error handling

**Status: PARTIAL.** Modern contract/signing/webhook/auth paths use
`SAFE_INTERNAL_ERROR_MESSAGE`, `toSafeClientErrorBody`, and safe provider
normalization; the global handler hides unexpected messages in production.
Multiple route/controller catches return `error.message` or provider-shaped
details directly, including request, client, doula, billing, financial, invoice,
portal, and QuickBooks paths. No reviewed path intentionally returns a stack
trace, but SQL/schema/provider messages can escape from handled routes.
Evidence: `server.ts`, `common/utils/safeLogging.ts`, the listed
controllers/routes.

## 25. Public intake security

**Status: PARTIAL.** `POST /requestService/requestSubmission` has a 512 KB
global JSON cap, normalization/validation, parameterized Cloud SQL inserts, a
honeypot, database-backed IP/email rate limits, idempotency keys, and soft
dedupe. The email issue is closed. Gaps: abuse middleware fails open on store
error; `extractClientIp` trusts `X-Forwarded-For` directly without a verified
trusted-proxy boundary; no CAPTCHA/provider bot attestation exists; some
controller errors return raw validation/database messages. Evidence:
`server.ts`, `requestRoute.ts`, intake domain/infrastructure,
`RequestFormController/Service/Repository`, `intakeAbuseProtection.test.ts`,
`requestSubmissionFlow.test.ts`, `intakeStaffNotificationEmail.test.ts`.

## 26. Webhook security

| Webhook                                            | Signature                                                                            | Timestamp                                                       | Replay/idempotency         | Body parsing                | Status             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------- | --------------------------- | ------------------ |
| `POST /quickbooks/webhooks/invoice-paid` and alias | Intuit HMAC, production fails closed                                                 | 15-minute check when header is present; missing header accepted | Cloud SQL unique event key | Raw body captured           | PARTIAL            |
| Stripe                                             | Feature-gated legacy routes; no mounted webhook identified in reviewed server mounts | NEEDS VERIFICATION                                              | NEEDS VERIFICATION         | Raw body globally available | NEEDS VERIFICATION |

Tests `webhookAndOauthSecurity.test.ts` and
`quickbooksInvoiceWebhookService.test.ts` cover signature validation, raw-body
compatibility, state/replay, and record correlation. Mandatory QuickBooks
created-time is a remaining gap; event-key idempotency limits its effect.

## 27. Test coverage

Repository-wide execution on 2026-09-04: **78 suites passed, 561 tests passed**.
A focused security subset also passed **16 suites and 179 tests**. Jest reported
a forced exit/open-handle warning, which is a test-harness quality issue but did
not fail either run.

| Security Control                      | Test File                                                                         | Test Exists? | What It Proves                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------- |
| Client cannot access another client   | `clientDoulaAssignmentAccess.test.ts`, `clientDocumentsController.test.ts`        | DONE         | Detail and document ownership denials                   |
| Doula cannot access unassigned client | `clientDoulaAssignmentAccess.test.ts`, `clientPhiEndpoint.test.ts`                | DONE         | Generic client/PHI paths deny mocked missing assignment |
| Billing cannot access clinical route  | `clientBirthOutcomesAuth.test.ts`, `authorizationMatrix.test.ts`                  | PARTIAL      | Selected routes only; no complete matrix                |
| Disabled user denied                  | None                                                                              | NOT DONE     | No global control/test                                  |
| Client CSV export blocked             | `clientCsvExportAuth.test.ts`                                                     | DONE         | Client, doula, billing blocked; admin allowed           |
| Arbitrary hours blocked               | `addHoursAuthorization.test.ts`, `hourEndpoints.test.ts`                          | DONE         | Role, doula ID, and assignment constraints              |
| Birth outcome assignment enforced     | `clientBirthOutcomesAuth.test.ts`, `clientBirthOutcomesEndpoint.test.ts`          | DONE         | Unassigned doula/billing/client denied writes           |
| Birth outcome original submitter      | None                                                                              | NOT DONE     | No attribution/control                                  |
| Notes assignment/visibility           | `clientActivitiesHttp.integration.test.ts`, `doulaActivities.integration.test.ts` | PARTIAL      | Assignment and client-visible behavior                  |
| Notes creator/edit rule               | None                                                                              | NOT DONE     | Repository lacks creator predicate                      |
| No raw card route                     | `simulatePaymentRouteDisabled.test.ts`                                            | DONE         | Legacy PAN/CVC handlers and mounts absent               |
| Free-text card field rejects PAN      | None                                                                              | NOT DONE     | Field accepts arbitrary string                          |
| Invoice idempotency/email failure     | `installmentInvoiceService.test.ts`                                               | DONE         | Lock/idempotency and no duplicate after email failure   |
| Card normalization/expiry/fallback    | `customerPaymentMethodStatus.test.ts`                                             | DONE         | Required normalized states and month boundary           |
| Webhook signature/replay              | `webhookAndOauthSecurity.test.ts`                                                 | DONE         | HMAC, raw body, duplicate claim, OAuth state            |
| PHI-free intake email                 | `intakeStaffNotificationEmail.test.ts`                                            | DONE         | Forbidden fields absent from staff/submitter templates  |
| PHI-free assignment email             | `doulaAssignmentNotificationEmail.test.ts`                                        | DONE         | Forbidden fields absent                                 |
| SMTP credential containment           | `smtpCredentialContainment.test.ts`                                               | DONE         | Environment lookup and source scan                      |
| Safe logging                          | `securityLogging.test.ts`                                                         | DONE         | Selected PHI/token/provider values omitted              |
| Contract role restrictions            | `authorizationMatrix.test.ts`, native `routes.test.ts`                            | PARTIAL      | Admin/client boundaries, not full business matrix       |

## 28. Prior findings

| Finding | Previous Risk                                          | Current Status     | Evidence                                                      | Remaining Work                                                                                |
| ------- | ------------------------------------------------------ | ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| INV-01  | Full clinical intake payload emailed through Gmail     | DONE               | Minimal builders/controller and passing test                  | Verify deployed revision/provider configuration.                                              |
| INV-02  | Client can export all-family CSV                       | DONE               | Admin-only route/use-case and passing test                    | Add approved finance/development roles without reopening client/doula access.                 |
| INV-03  | Unassigned doula can read another family               | DONE               | Record checks and tests on reviewed routes                    | Resolve split assignment source and inactive-user gap under INV-04/BE-004.                    |
| INV-04  | Assignment checks split between Cloud SQL and Supabase | DONE               | Shared Cloud SQL active-assignment checks and lifecycle tests | Continue production verification during Identity Platform cutover.                            |
| INV-05  | Vendor/BAA status not established                      | NEEDS VERIFICATION | Source names vendors but contains no executed agreements      | Obtain/retain vendor agreements and architecture approval.                                    |
| INV-06  | `self_pay_card_info` free-text PAN risk                | NOT DONE           | Arbitrary string accepted/persisted/returned                  | Remove/migrate field; reject card-number/CVC patterns; store masked structured metadata only. |
| INV-09  | Any authenticated user can post arbitrary hours        | DONE               | Role/doula/assignment checks and passing test                 | Unify assignment source and strengthen account-status/update rules.                           |
| INV-10  | Admin simulate-payment accepts PAN/CVC                 | DONE               | Route/handlers absent and passing unmounted test              | Keep regression test.                                                                         |
| INV-11  | Hardcoded Gmail app password                           | DONE               | Environment-only script/service and passing containment test  | Verify Secret Manager binding and rotation operationally.                                     |
| INV-12  | Birth-outcome assignment/write gap                     | PARTIAL            | Assignment enforced/tested                                    | Add submitter/updater attribution and creator/admin override rules.                           |
| INV-13  | Notes assignment/authorization gap                     | PARTIAL            | Assignment/read visibility enforced                           | Enforce creator-only edits, retention/versioning, audit.                                      |

## 29. Additional findings

| ID           | Finding                                                                                   | Severity | Status   | Evidence                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------- |
| HIPAA-BE-001 | Doulas can retrieve the entire invoice list                                               | P0       | DONE     | `invoiceRoutes.ts`; `authorizationPolicies.ts`; `hipaaP0Containment.test.ts`             |
| HIPAA-BE-002 | Doulas can retrieve and CSV-export organization-wide reconciliation/payment data          | P0       | DONE     | `financialRoutes.ts`; `paymentRoutes.ts`; `hipaaP0Containment.test.ts`                   |
| HIPAA-BE-003 | Doulas can retrieve/update billing and insurance for assigned clients                     | P0       | DONE     | `clientRoutes.ts`; `paymentMethodRoutes.ts`; role-minimized `ClientController` responses |
| HIPAA-BE-004 | Inactive/terminated doula status is not checked per request                               | P0       | DONE     | `authMiddleware.ts`; `security/accountAccess.ts`; `hipaaP0Containment.test.ts`           |
| HIPAA-BE-005 | Free-text card field can contain PAN/CVC-like data                                        | P0       | DONE     | intake/client validation; forced-null repository normalization; response omission tests  |
| HIPAA-BE-006 | Any authenticated user can enumerate staff                                                | P1       | NOT DONE | `GET /auth/users`; `AuthController.getAllUsers`                                          |
| HIPAA-BE-007 | Any authenticated user can retrieve an arbitrary workforce profile by ID                  | P1       | NOT DONE | `specificUserRoutes.ts`; user controller/team service                                    |
| HIPAA-BE-008 | Supabase remains an active client/document/contract data dependency                       | P1       | PARTIAL  | `index.ts`; dashboard, user, doula-document, contract services                           |
| HIPAA-BE-009 | Assigned doula can edit another creator's note visibility                                 | P1       | NOT DONE | `DoulaController.patchClientActivity`; activity repository update predicate              |
| HIPAA-BE-010 | Contract access/download matrix does not implement billing/doula/client/executive policy  | P1       | PARTIAL  | native routes; `billingRoutes.ts`; no executive role                                     |
| HIPAA-BE-011 | QuickBooks OAuth start route is not protected by CRM admin/billing auth                   | P1       | PARTIAL  | `quickbooksRoutes.ts` `/auth` and `/callback`; single-use state exists                   |
| HIPAA-BE-012 | Generic client detail returned to doulas includes insurance/payment/free-text card fields | P0       | NOT DONE | `ClientController.getClientById`; detailed Cloud SQL mapper/DTO                          |
| HIPAA-BE-013 | Active CloudConvert path receives filled contract DOCX                                    | P1       | PARTIAL  | template generate route → `convertToPdf.ts`                                              |
| HIPAA-BE-014 | Doula-document metadata remains in Supabase and doula self-download URLs are returned     | P1       | PARTIAL  | `DoulaDocumentRepository`; `DoulaController.getMyDocuments/uploadDocument`               |
| HIPAA-BE-015 | Legacy handled errors return raw internal messages                                        | P2       | PARTIAL  | invoice/financial/client/doula/portal/QuickBooks handlers                                |
| HIPAA-BE-016 | Intake IP throttling directly trusts caller-supplied `X-Forwarded-For`                    | P2       | PARTIAL  | `extractClientIp` in intake abuse protection                                             |
| HIPAA-BE-017 | No comprehensive sensitive-read/write/download/export/account audit trail                 | P1       | PARTIAL  | audit inventory above                                                                    |
| HIPAA-BE-018 | Public signup and mixed account stores make invite-only onboarding enforcement unclear    | P2       | PARTIAL  | `POST /auth/signup`; `AuthUseCase`; `SupabaseUserRepository`                             |
| HIPAA-BE-019 | Assignment records lack active/end state and revocation history                           | P1       | NOT DONE | `CloudSqlDoulaAssignmentService`; assignment migrations                                  |
| HIPAA-BE-020 | Billing reminder API permits arbitrary ordinary-email subject/body                        | P1       | NOT DONE | `billingRoutes.ts`; `billingReminderService.ts`                                          |

## 30. Backend HIPAA remediation tracker

The 48 tracker controls below are the denominator for the final status count.

### DONE

| ID      | Control / Finding                          | Status | Severity | Evidence                                          | Remaining Work                               |
| ------- | ------------------------------------------ | ------ | -------- | ------------------------------------------------- | -------------------------------------------- |
| CTRL-01 | Provider token signature/expiry validation | DONE   | P1       | `authMiddleware.ts`; identity token service       | Verify deployed provider config.             |
| CTRL-02 | Server-authoritative role resolution       | DONE   | P1       | `resolveAuthoritativeRole.ts`                     | Retire app-managed fallback after migration. |
| CTRL-03 | Client self-record ownership               | DONE   | P0       | client controller/document/native-contract routes | Maintain tests.                              |
| CTRL-04 | Admin-only all-client CSV                  | DONE   | P0       | route/use case/test                               | Add explicit approved staff roles later.     |
| CTRL-05 | PHI-free intake notification               | DONE   | P0       | intake builder/controller/test                    | Production delivery spot-check.              |
| CTRL-06 | Minimized assignment notification          | DONE   | P1       | assignment builder/service/test                   | Production delivery spot-check.              |
| CTRL-07 | Production safe logging boundary           | DONE   | P1       | safe logger/console guard/test                    | Convert legacy console calls.                |
| CTRL-08 | Simulated PAN/CVC route removed            | DONE   | P0       | server/routes/test                                | Keep regression test.                        |
| CTRL-09 | Tokenized payment-method POST schema       | DONE   | P0       | payment method route/service                      | Remove doula role.                           |
| CTRL-10 | Card status normalization/expiry/fallback  | DONE   | P1       | card service/test                                 | Monitor provider failures.                   |
| CTRL-11 | Installment invoice idempotency            | DONE   | P1       | service/migration/test                            | Operational reconciliation.                  |
| CTRL-12 | Webhook HMAC and duplicate claim           | DONE   | P1       | webhook auth/store/tests                          | Add mandatory freshness where possible.      |
| CTRL-13 | SMTP source credential containment         | DONE   | P0       | script/service/test                               | Verify Secret Manager/rotation.              |
| CTRL-14 | Private GCS API and signed URLs            | DONE   | P1       | GCS service/upload services/tests                 | Verify bucket IAM.                           |
| CTRL-15 | Native contract integrity/audit events     | DONE   | P1       | native repositories/services/tests                | Verify migrations/worker deployment.         |

### PARTIAL

| ID      | Control / Finding                | Status  | Severity | Evidence                                                                                                                        | Remaining Work                                                                                |
| ------- | -------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| CTRL-16 | Identity Platform migration      | PARTIAL | P1       | dual-provider middleware; Cloud SQL identity-link service/migration; four admin links and 55 disabled doula accounts reconciled | Notify/activate the doula cohort, migrate clients, complete cutover, and disable legacy auth. |
| CTRL-17 | Unified assignment authorization | DONE    | P0       | Cloud SQL service, lifecycle migration, tests                                                                                   | Production verification during auth cutover.                                                  |
| CTRL-18 | Active-doula revocation          | PARTIAL | P0       | status fields exist but middleware ignores them                                                                                 | Check status each request and revoke tokens.                                                  |
| CTRL-19 | Business RBAC matrix             | PARTIAL | P0       | route matrix                                                                                                                    | Implement explicit roles and least privilege.                                                 |
| CTRL-20 | Client-detail field minimization | PARTIAL | P0       | controller/DTO                                                                                                                  | Split clinical vs billing DTOs.                                                               |
| CTRL-21 | Birth outcomes                   | PARTIAL | P1       | controller/tests                                                                                                                | Add author/override/audit.                                                                    |
| CTRL-22 | Service hours                    | PARTIAL | P1       | hour controllers/tests                                                                                                          | Unify assignment/status; define edit/delete rules.                                            |
| CTRL-23 | Notes                            | PARTIAL | P1       | activity controllers/repository                                                                                                 | Creator edit, versions, retention, audit.                                                     |
| CTRL-24 | Exact export policy              | PARTIAL | P1       | CSV and financial routes                                                                                                        | Add approved roles/export classes; remove doula.                                              |
| CTRL-25 | Email/communications policy      | PARTIAL | P1       | email flows                                                                                                                     | Constrain custom text and signed-file delivery.                                               |
| CTRL-26 | Card-data boundary               | PARTIAL | P0       | tokenized API plus free-text field                                                                                              | Remove free-text PAN path.                                                                    |
| CTRL-27 | Billing role enforcement         | PARTIAL | P0       | client/invoice/financial/payment routes                                                                                         | Rebuild route policy.                                                                         |
| CTRL-28 | Contract authorization           | PARTIAL | P1       | native/legacy/billing routes                                                                                                    | Implement view/download matrix.                                                               |
| CTRL-29 | CloudConvert minimization        | PARTIAL | P1       | active conversion path                                                                                                          | Remove or minimize; complete vendor review.                                                   |
| CTRL-30 | Document architecture            | PARTIAL | P1       | GCS plus Supabase metadata/legacy files                                                                                         | Finish migration and retention/audit.                                                         |
| CTRL-31 | Audit logging coverage           | PARTIAL | P1       | contract/onboarding events only                                                                                                 | Add central immutable audit ledger.                                                           |
| CTRL-32 | Error sanitization               | PARTIAL | P2       | mixed safe and raw handlers                                                                                                     | Standardize all handlers.                                                                     |
| CTRL-33 | Public intake abuse defense      | PARTIAL | P2       | rate limit/idempotency/honeypot                                                                                                 | Trusted proxy, fail-closed strategy, bot control.                                             |

### NOT DONE

| ID                     | Control / Finding                 | Status   | Severity | Evidence                                    | Remaining Work                                     |
| ---------------------- | --------------------------------- | -------- | -------- | ------------------------------------------- | -------------------------------------------------- |
| CTRL-34 / HIPAA-BE-001 | Block doulas from all invoices    | NOT DONE | P0       | `invoiceRoutes.ts`                          | Allow admin/billing; add client-own invoice route. |
| CTRL-35 / HIPAA-BE-002 | Block doula reconciliation/export | NOT DONE | P0       | `financialRoutes.ts`                        | Restrict to approved finance/admin roles.          |
| CTRL-36 / HIPAA-BE-004 | Global disabled-account denial    | NOT DONE | P0       | auth middleware/resolver                    | Enforce status and immediate revocation.           |
| CTRL-37                | Server-side one-hour inactivity   | NOT DONE | P1       | cookie only                                 | Add revocable activity-backed sessions.            |
| CTRL-38 / HIPAA-BE-009 | Creator-only note edit            | NOT DONE | P1       | activity update predicate                   | Require creator or authorized admin override.      |
| CTRL-39                | Note retention/versioning         | NOT DONE | P1       | no soft-delete/version model                | Add immutable versions and retention.              |
| CTRL-40                | Birth-outcome submitter ownership | NOT DONE | P1       | no author columns/check                     | Add submitter/updater and override event.          |
| CTRL-41 / HIPAA-BE-010 | Executive-only contract download  | NOT DONE | P1       | billing/client downloads; no executive role | Add role and separate view/download actions.       |

### NEEDS VERIFICATION

| ID      | Control / Finding                                             | Status             | Severity | Evidence                                   | Remaining Work                             |
| ------- | ------------------------------------------------------------- | ------------------ | -------- | ------------------------------------------ | ------------------------------------------ |
| CTRL-42 | Vendor BAAs/agreements                                        | NEEDS VERIFICATION | P1       | Vendors identifiable in code only          | Legal/vendor evidence.                     |
| CTRL-43 | Production Secret Manager and rotation                        | NEEDS VERIFICATION | P1       | env lookups/docs only                      | Inspect deployed bindings/audit/rotation.  |
| CTRL-44 | Cloud Run/Cloud SQL private topology, TLS, IAM                | NEEDS VERIFICATION | P1       | pool/build/deploy files insufficient       | Inspect live configuration.                |
| CTRL-45 | Backups, PITR, restore and one-hour RTO                       | NEEDS VERIFICATION | P1       | manual script/docs only                    | Run documented restore exercise.           |
| CTRL-46 | Account/document/data migration reconciliation                | NEEDS VERIFICATION | P1       | migration code and residual Supabase paths | Inventory, hash/count reconcile, sign-off. |
| CTRL-47 | Vercel shutdown/subscription/refund                           | NEEDS VERIFICATION | P3       | Leadership statement only                  | Retain console/billing evidence.           |
| CTRL-48 | Dormant/access reviews, policies, training, incident response | NEEDS VERIFICATION | P3       | Not provable from backend                  | Complete governance evidence.              |

## 31. Technical remediation implementation coverage

This is **not a HIPAA compliance percentage**. Within each category, the
specifically reviewed controls were scored DONE = 1, PARTIAL = 0.5, and NOT
DONE/NEEDS VERIFICATION = 0. Percentage = earned points ÷ controls reviewed.
Categories overlap the 48-item tracker because they measure implementation
dimensions, not unique legal requirements.

| Category                    | Reviewed mix                                        |    Calculation | Coverage |
| --------------------------- | --------------------------------------------------- | -------------: | -------: |
| Authentication / identity   | 4 DONE, 2 PARTIAL, 1 NOT DONE                       |    (4 + 1) / 7 |      71% |
| Authorization / BOLA        | 3 DONE, 5 PARTIAL, 4 NOT DONE                       | (3 + 2.5) / 12 |      46% |
| PHI handling                | 2 DONE, 2 PARTIAL, 1 NOT DONE                       |    (2 + 1) / 5 |      60% |
| Email / communications      | 4 DONE, 1 PARTIAL                                   |  (4 + 0.5) / 5 |      90% |
| Billing security            | 5 DONE, 1 PARTIAL, 2 NOT DONE                       |  (5 + 0.5) / 8 |      69% |
| Contracts                   | 3 DONE, 4 PARTIAL, 1 NOT DONE                       |    (3 + 2) / 8 |      63% |
| Documents / storage         | 2 DONE, 4 PARTIAL, 1 NOT DONE                       |    (2 + 2) / 7 |      57% |
| Audit logging               | 2 DONE, 4 PARTIAL, 4 NOT DONE                       |   (2 + 2) / 10 |      40% |
| Secrets                     | 3 DONE, 1 NEEDS VERIFICATION                        |          3 / 4 |      75% |
| Session / account lifecycle | 1 DONE, 2 PARTIAL, 2 NOT DONE, 2 NEEDS VERIFICATION |    (1 + 1) / 7 |      29% |
| Webhooks                    | 4 DONE, 2 PARTIAL                                   |    (4 + 1) / 6 |      83% |
| Testing                     | 8 DONE, 6 PARTIAL                                   |   (8 + 3) / 14 |      79% |

## 32. Leadership update and migration timeline

The supplied update says Vercel was deleted/canceled with an expected
approximate $7 refund; migration from remaining Supabase services to Google
Cloud was approved; work was targeted for August 26 through September 1;
client/family access would remain disabled during testing; and formal risk
assessment, policies, BAAs, training, incident response, and legal review would
follow. Those statements are useful governance context but are not source-code
evidence.

| Leadership statement                               | Code assessment                                                              | Status             |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| Access controls strengthened                       | Multiple controls/tests exist, but P0 route and inactive-user gaps remain    | PARTIAL            |
| Bulk client downloads restricted                   | Narrow `/clients/fetchCSV` claim is confirmed                                | DONE               |
| Unassigned doula access blocked                    | Reviewed routes have checks/tests; split assignment authority remains        | PARTIAL            |
| Sensitive data removed from logs                   | Production containment is confirmed; legacy non-production calls remain      | PARTIAL            |
| Intake/assignment emails minimized                 | Confirmed by active builders and tests                                       | DONE               |
| Payment testing removed                            | Confirmed unmounted/absent and tested                                        | DONE               |
| Email password rotated and moved to secure storage | Hardcoded source value removed; rotation/storage deployment cannot be proven | NEEDS VERIFICATION |
| Security tests added                               | Confirmed; full run passed 78 suites and 561 tests                           | DONE               |
| Vercel shutdown/refund                             | No runtime/console/billing evidence in repository                            | NEEDS VERIFICATION |
| Remaining Supabase migration approved/completed    | Direction is documented; current code still uses Supabase data/storage       | PARTIAL            |
| Account/document reconciliation completed          | Cannot be proven from code                                                   | NEEDS VERIFICATION |
| Formal governance work remains                     | Consistent with code-review limitations                                      | NEEDS VERIFICATION |

## Final counts and evidence index

### Status counts

- **DONE:** 15
- **PARTIAL:** 18
- **NOT DONE:** 8
- **NEEDS VERIFICATION:** 7
- **NOT APPLICABLE:** 0 in the 48-control remediation tracker
- **Total controls:** 48

### Open P0 findings

- HIPAA-BE-001 — organization-wide invoices available to doulas.
- HIPAA-BE-002 — organization-wide reconciliation JSON/CSV available to doulas.
- HIPAA-BE-003 — assigned-client billing/insurance read and write available to
  doulas.
- HIPAA-BE-004 — inactive/terminated doulas not denied per request.
- HIPAA-BE-005 — arbitrary free-text card information persistence.
- HIPAA-BE-012 — generic doula client detail includes
  billing/insurance/card-information fields.

### Open P1 findings

- HIPAA-BE-006, HIPAA-BE-007 — authenticated workforce-directory/profile
  exposure.
- HIPAA-BE-008 — residual active Supabase data/storage dependencies.
- HIPAA-BE-009 — note creator/edit rule absent.
- HIPAA-BE-010 — contract view/download role mismatch.
- HIPAA-BE-011 — app-public QuickBooks OAuth initiation.
- HIPAA-BE-013 — filled contract sent to CloudConvert; vendor review required.
- HIPAA-BE-014 — doula document metadata/download mismatch.
- HIPAA-BE-017 — incomplete audit logging.
- HIPAA-BE-019 — no assignment end-state/history.
- HIPAA-BE-020 — arbitrary billing email content.
- CTRL-37, CTRL-39, CTRL-40 — inactivity, note retention/versioning, and
  birth-outcome submitter control.

### Exact files supporting each DONE tracker claim

| DONE ID | Exact implementation files                                                                                                                                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CTRL-01 | `src/middleware/authMiddleware.ts`; `src/services/identityPlatform/identityPlatformTokenService.ts`; `src/services/supabaseAuthService.ts`                                                                                                                                          |
| CTRL-02 | `src/security/resolveAuthoritativeRole.ts`; `src/middleware/authorizeRoles.ts`                                                                                                                                                                                                      |
| CTRL-03 | `src/controllers/clientController.ts`; `src/routes/clientRoutes.ts`; `src/features/contracts/routes/clientContractRoutes.ts`; `src/features/contracts/controllers/contractController.ts`                                                                                            |
| CTRL-04 | `src/routes/clientRoutes.ts`; `src/security/authorizationPolicies.ts`; `src/usecase/clientUseCase.ts`                                                                                                                                                                               |
| CTRL-05 | `src/controllers/requestFormController.ts`; `src/features/intake/notifications/intakeStaffNotificationEmail.ts`                                                                                                                                                                     |
| CTRL-06 | `src/features/assignments/notifications/doulaAssignmentNotificationEmail.ts`; `src/services/emailService.ts`                                                                                                                                                                        |
| CTRL-07 | `src/common/utils/logger.ts`; `src/common/utils/safeLogging.ts`; `src/server.ts`                                                                                                                                                                                                    |
| CTRL-08 | `src/server.ts`; `src/routes/quickbooksRoutes.ts`; `src/routes/paymentMethodRoutes.ts`                                                                                                                                                                                              |
| CTRL-09 | `src/routes/paymentMethodRoutes.ts`; `src/controllers/paymentMethodController.ts`; `src/services/payments/customerPaymentMethodService.ts`                                                                                                                                          |
| CTRL-10 | `src/services/payments/customerPaymentMethodService.ts`; `src/repositories/cloudSqlPaymentMethodRepository.ts`                                                                                                                                                                      |
| CTRL-11 | `src/services/installmentInvoiceService.ts`; `src/db/migrations/add_installment_invoice_tracking.sql`                                                                                                                                                                               |
| CTRL-12 | `src/security/webhookAuth.ts`; `src/security/webhookCrypto.ts`; `src/security/webhookEventStore.ts`; `src/controllers/quickbooksWebhookController.ts`; `src/db/migrations/add_webhook_events_and_oauth_states.sql`                                                                  |
| CTRL-13 | `src/scripts/sendTestEmail.ts`; `src/services/emailService.ts`; `.env.example`                                                                                                                                                                                                      |
| CTRL-14 | `src/services/gcs/documentStorage.ts`; `src/services/clientDocumentUploadService.ts`; `src/services/doulaDocumentUploadService.ts`; `src/repositories/clientDocumentRepository.ts`                                                                                                  |
| CTRL-15 | `src/features/contracts/repositories/eventRepository.ts`; `src/features/contracts/repositories/contractRepository.ts`; `src/features/contracts/services/contractService.ts`; `src/features/contracts/services/signingSessionService.ts`; `src/features/contracts/pdf/pdfService.ts` |

### Tests supporting each DONE tracker claim

| DONE ID | Tests                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CTRL-01 | `src/__tests__/authCompatibility.test.ts`; `src/__tests__/authorizationMatrix.test.ts`                                                                                                                                         |
| CTRL-02 | `src/__tests__/authCompatibility.test.ts`; `src/__tests__/authorizationMatrix.test.ts`                                                                                                                                         |
| CTRL-03 | `src/__tests__/clientDoulaAssignmentAccess.test.ts`; `src/__tests__/clientDocumentsController.test.ts`; `src/features/contracts/__tests__/routes.test.ts`                                                                      |
| CTRL-04 | `src/__tests__/clientCsvExportAuth.test.ts`                                                                                                                                                                                    |
| CTRL-05 | `src/__tests__/intakeStaffNotificationEmail.test.ts`; `src/__tests__/requestSubmissionFlow.test.ts`                                                                                                                            |
| CTRL-06 | `src/__tests__/doulaAssignmentNotificationEmail.test.ts`                                                                                                                                                                       |
| CTRL-07 | `src/__tests__/securityLogging.test.ts`                                                                                                                                                                                        |
| CTRL-08 | `src/__tests__/simulatePaymentRouteDisabled.test.ts`; `src/__tests__/paymentMethodsMount.test.ts`                                                                                                                              |
| CTRL-09 | `src/__tests__/simulatePaymentRouteDisabled.test.ts`; `src/__tests__/customerPaymentMethodStatus.test.ts`                                                                                                                      |
| CTRL-10 | `src/__tests__/customerPaymentMethodStatus.test.ts`; `src/__tests__/portalEligibilityComputation.test.ts`                                                                                                                      |
| CTRL-11 | `src/__tests__/installmentInvoiceService.test.ts`                                                                                                                                                                              |
| CTRL-12 | `src/__tests__/webhookAndOauthSecurity.test.ts`; `src/__tests__/quickbooksInvoiceWebhookService.test.ts`                                                                                                                       |
| CTRL-13 | `src/__tests__/smtpCredentialContainment.test.ts`; `src/__tests__/env.test.ts`                                                                                                                                                 |
| CTRL-14 | `src/__tests__/clientDocumentUploadService.test.ts`; `src/__tests__/clientDocumentsController.test.ts`; `src/__tests__/doulaDocumentUploadService.test.ts`; `src/__tests__/profilePictureStorage.test.ts`                      |
| CTRL-15 | `src/features/contracts/__tests__/statusMachine.test.ts`; `nativePdf.test.ts`; `signingSessionService.test.ts`; `signingManifest.test.ts`; `outboxService.test.ts`; `src/__tests__/contractSignatureCompletionService.test.ts` |

### Controls not determinable from the backend repository

- Whether current production traffic runs Identity Platform, Supabase, or dual
  authentication.
- Whether client/family access is disabled during migration.
- Whether Supabase/Vercel resources are disabled, deleted, or still contain
  data; whether a refund occurred.
- Whether all staff accounts/documents/data were migrated and reconciled
  correctly.
- Live Cloud Run ingress, invoker policy, service account, revision,
  environment, feature flags, and secret bindings.
- Cloud SQL private IP/VPC, firewall, certificate verification, IAM, database
  grants, encryption settings, backups, PITR, restore success, or measured
  RTO/RPO.
- GCS bucket IAM/public-access prevention, encryption key choice, versioning,
  retention, lifecycle, access logs, scanning, and recovery.
- Provider BAAs/agreements, including Google Cloud, Supabase, CloudConvert,
  Intuit/QuickBooks, and email.
- Production log sinks, retention, access controls, alerting, and incident
  monitoring.
- Formal risk assessment, security/privacy policies, sanctions, training,
  incident response, breach workflow, six-month access review, and 90-day
  dormant-account review.
- Whether users share credentials or downloaded files are retained on staff
  endpoints.
- Frontend inactivity warning/logout implementation.
- Legal interpretation of minimum necessary use or whether a particular
  vendor/workflow is permissible.

“Based on the backend code review, these controls are technically implemented or
outstanding. This review does not constitute a legal HIPAA compliance
determination or certification.”
