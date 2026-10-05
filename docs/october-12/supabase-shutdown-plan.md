# Supabase independence: release gate and S1 findings

Updated September 17, 2026. The supplied S1-S11 backlog supersedes the earlier
decision to defer Supabase exit. October 12 now requires tenant-safe
care/billing and a Supabase-independent runtime. Preserve the original backlog
as history; use this change and `supabase-shutdown-backlog.md` as the current
scope.

## Status and evidence limits

- S1: in progress; cross-repository source search and critical call-chain review
  completed, but not exhaustive production reachability verification.
- S2: pending read-only database inventory and cross-store reconciliation.
- S3-S7: implementation pending dependency/data verification.
- S8: backup destination/access decision pending; no backup/export performed.
- S9-S11: not started; their prerequisite gates are not satisfied.

The source-search TSV snapshot was removed after SignNow/DocuSign adapters were
deleted. Remaining Supabase dependencies still need call-chain and production
verification: inspect URLs in records, RPCs, views, functions, triggers,
webhooks, scheduled tasks, storage and built frontend artifacts.

## Reviewed dependencies

| Category                              | Source / path                                                                                       | Finding                                                                                                                          | Runtime evidence and required action                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                                  | `middleware/authMiddleware.ts`, `services/supabaseAuthService.ts`                                   | Dual-mode validation can call Supabase; auth service has further dependencies.                                                   | Production revision explicitly sets `AUTH_PROVIDER=dual`. Migrate each user role and all login/session/recovery/invite flows before cutover.                        |
| Auth/client onboarding                | `services/portalInviteService.ts`, `routes/clientRoutes.ts`                                         | Supabase admin create-user, list-user and generate-link calls remain.                                                            | Service is instantiated by mounted client router; trace each invitation caller and replace with Identity Platform onboarding.                                       |
| Frontend auth                         | CRM `features/auth/ClientLogin.tsx`                                                                 | Calls Supabase password sign-in directly.                                                                                        | Screen mounted at `/auth/client-login` in local `Routes.tsx`; deployed source provenance still pending. Replace the client path, not just staff auth configuration. |
| Frontend auth                         | CRM `features/auth/SetPassword.tsx`                                                                 | Supabase session setup, session lookup and password update.                                                                      | Mounted at `/auth/set-password`; preserve invitation/recovery links or provide a deliberate reissue process.                                                        |
| Frontend auth                         | CRM `common/hooks/auth/useClientAuth.ts`, `common/contexts/UserContext.tsx`, `api/http.ts`          | Session lookup/subscription and fallback paths.                                                                                  | Check actual `UserContext.jsx` resolution versus TSX sibling. Remove fallback network access in no-Supabase mode, including anonymous/startup states.               |
| Client portal                         | CRM `ClientContractsTab.tsx`, `ClientPaymentHistoryTab.tsx`, `ClientProfileTab.tsx`                 | Direct session reads; profile also calls auth user updates.                                                                      | Used by client dashboard source. Route every request through common non-Supabase auth transport.                                                                    |
| Initialization                        | `src/supabase.ts`, `config/env.ts`, `createBackendSupabaseClient.ts`                                | Lazy client still requires URL/service key on first access.                                                                      | Import/startup success does not prove request independence. Test compiled runtime without variables and with Supabase requests denied.                              |
| Contracts/storage                     | `services/supabaseContractService.ts`                                                               | `createContract` and `fetchContractPDF` still use Supabase tables/storage.                                                       | Wired through `index.ts`/contract use case; establish actual endpoint/worker callers before classifying as removable. Preserve contracts and signed bytes.          |
| Storage (already migrated methods)    | Same contract service, template methods                                                             | Template list/upload/delete/download methods use GCS.                                                                            | Mounted `/contracts/templates` and `/api/contracts/templates` routers. Do not unnecessarily remigrate GCS-backed behavior because of the class name.                |
| Contracts                             | `services/contractClientService.ts`                                                                 | Remaining lookups should use Cloud SQL. Classify method-by-method; inspect completion and cleanup callers, not only HTTP routes. |
| Intake                                | `requestFormRepository.saveData`                                                                    | Inserts new public intake into Cloud SQL `phi_clients`.                                                                          | `/requestService/requestSubmission` -> controller/service/repository (or feature adapter). Verify both flag branches and notifications end to end.                  |
| Intake history                        | `getUserRequests`, `getRequestById`, `getAllRequests`, `getRequestByIdAdmin`, `updateRequestStatus` | Still query/update Supabase `requests`.                                                                                          | Caller and deployed usage not yet established. Migrate/archive data before retiring these methods.                                                                  |
| Hours                                 | `supabaseUserRepository.getHoursById/getAllHours/addNewHours/updateHourType`                        | These methods use Cloud SQL hours.                                                                                               | Mounted hours handlers go through `userUseCase`. Extract without response changes; audit alternate writers before declaring no Supabase hours access anywhere.      |
| Identity/client data                  | Other `supabaseUserRepository` methods                                                              | Supabase `users`, `client_info`, `assignments`, `notes` calls remain.                                                            | Used by composed user use case; replacing auth middleware alone does not remove all application data dependence.                                                    |
| Client data                           | `cloudSqlClientRepository`, Cloud SQL activity/document repositories                                | Core paths already target Cloud SQL; some signatures/comments retain Supabase references.                                        | Separate type-only/constructor dependencies from real I/O. Preserve Cloud SQL data ownership.                                                                       |
| Storage                               | GCS profile/document services; existing migration script                                            | Current upload paths have GCS implementations. Old stored URLs/objects can still depend on Supabase.                             | Reconcile object manifests and references, not just upload code. Review `scripts/migrate-supabase-storage-to-gcs.ts` before use.                                    |
| Billing/payment (additional category) | `paymentScheduleService.ts`, `stripePaymentService.ts`                                              | Supabase RPCs and schedule/payment/reminder table operations remain.                                                             | Some route files may be unmounted; trace every caller/job/flag. Do not mark unused from route names alone.                                                          |
| Billing/accounting                    | `invoice/persistInvoiceToSupabase.ts`, customer upsert/QBO-ID helpers                               | Direct writes to Supabase invoices/customers.                                                                                    | Inspect QuickBooks invoice/customer chains and flags; replace or retire only after financial reconciliation.                                                        |
| Legacy candidates                     | JS siblings, Supabase client/activity/assignment repositories, manual scripts                       | Potential alternative implementations.                                                                                           | No blanket dead-code classification. Check TS/JS resolution, package scripts, CI and external schedulers.                                                           |

Billing/payment is added as an explicit inventory category because it is a
critical dependency that would be hidden by the supplied category list alone.

## S2: required source-of-truth reconciliation

Capture all schemas, tables, views, routines, triggers, policies, extensions and
scheduled tasks through a read-only SQL connection. For every relevant table,
record exact count, primary key, nullable timestamps and maximum created/updated
timestamp where those columns exist. Record capture time and permissions:
RLS-filtered API counts cannot establish a complete table inventory.

Proposed mappings to validate, not assumed equivalences:

| Supabase source                                                        | Candidate destination / reconciliation rule                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth users/identities and public users                                 | Identity Platform plus stable internal IDs and tenant memberships; verify each active account/link, role, disabled state and recovery path. |
| `client_info` / requests                                               | `phi_clients` plus retained intake history; reconcile IDs and statuses without reducing distinct requests to one client row.                |
| Doulas / assignments / hours / notes                                   | Cloud SQL providers/assignments/hours/activities; preserve source IDs and historical provenance; never mark old hours newly billable.       |
| Contracts / templates / signing metadata                               | `phi_contracts` or explicit legacy agreement adapter, template versions and GCS artifacts; preserve signature evidence and timestamps.      |
| Customers / invoices / payments / schedules / installments / reminders | Corresponding canonical Cloud SQL ledger/projections; reconcile external provider IDs and financial totals before merging.                  |
| Storage buckets/objects                                                | Private GCS; exact bytes, checksums, metadata and ownership, plus replacement references.                                                   |

Use anti-joins or ID-mapping manifests, not counts alone, to find missing
records. Do not merge solely on email. Log conflicts for review. Store only
aggregate findings and artifact references in Git, not PHI, tokens or exported
auth data.

## Backup and cutover gates

1. Confirm controlled encrypted destination, access principals, retention and
   restore owner. The question is pending; do not export sensitive data to an
   arbitrary repository or temporary plaintext location.
2. Back up database schema/data, auth-relevant records, storage object bytes and
   relevant configuration. A database dump alone does not include stored files.
   Preserve encryption/key access independently from the Supabase project.
3. Verify integrity and restore to an isolated environment. Record manifests,
   counts and checksums without PHI in source control.
4. Reconcile and migrate required records, preserving original identifiers via
   mapping where needed. Design delta capture or a brief write freeze so changes
   after the initial export are not lost. Perform final reconciliation/backup.
5. Verify Identity Platform mapping and onboarding/recovery for admin, billing,
   doula and family roles. Existing Supabase sessions will need a deliberate
   expiration/reauthentication strategy; do not treat their tokens as IdP
   tokens.
6. Replace remaining contract/intake/billing/storage calls, then extract hours
   with tenant scope, approval and audit dependencies as already planned.
7. Boot and test backend and build/run frontend without Supabase variables.
   Ensure dotenv or image-bundled configuration cannot silently restore them.
8. Test full workflow in staging with outbound Supabase access denied and
   network observation in both browser and server. Absence of application log
   messages alone is not proof of no calls. Cover refresh, logout, invites,
   reset-password, callbacks, document downloads, scheduled jobs, retries and
   failure branches.
9. Only after staging gates pass, deploy a production revision without Supabase
   variables and dependencies. Identify rollback digest/config and data
   compatibility first. Keep Supabase available during initial monitored
   cutover.
10. Run production smoke tests and confirm no active jobs/webhooks/URLs depend
    on Supabase. Define and complete an observation interval covering scheduled
    work, with controlled staging clock/job tests for periods longer than the
    interval.
11. Before shutdown, preserve a tested Supabase-free rollback revision. An older
    dual-auth revision ceases to be a viable rollback after credential
    revocation or project deletion. Verify final backup, then execute the
    requested account shutdown/cost action and revoke credentials. Verify actual
    billing outcome; do not assume pausing and deletion have identical billing
    behavior.

## Immediate next work

- Finish static caller classification and deployed image/source provenance.
- Obtain read-only database inventory and decide backup destination/access.
- Audit existing admin/doula identity and storage migration scripts; do not run
  mutation scripts until manifests and rollback/restore checks are prepared.
- Rebaseline the October 12 schedule: reduce broad relocation work first, retain
  tenant isolation, audit, duplicate prevention and preservation gates.

No credentials were removed, auth mode changed, records migrated, backups
exported, or Supabase project/billing action performed during this review.

## Existing GCS migration evidence

Jerry reports prior migration into GCS. `docs/GCS_DOCUMENT_STORAGE.md` records
completed cutovers for contract templates, client documents, doula documents and
profile pictures, targeting `gs://sokana-private-documents`. Signed-contract
cutover and emptying Supabase buckets remain unchecked in that document.

`scripts/migrate-supabase-storage-to-gcs.ts` defaults to read-only comparison,
downloads source/destination bytes in memory and compares SHA-256 hashes. Its
apply mode is opt-in and must not be used just to verify prior work. It covers
five named buckets, so reconcile the actual Supabase bucket inventory before
claiming complete coverage. An empty current source cannot by itself prove an
earlier migration was complete: retain historical manifests and restore
evidence.

The existing operational GCS bucket is not yet confirmed as the destination for
a full encrypted database/auth backup, nor are restore principals confirmed. Do
not infer that moving documents also migrated auth users or database tables.

`docs/SUPABASE_FULL_EXIT_LAUNCH_PLAN.md` already records an August 25 full-exit
decision. `docs/SUPABASE_DATABASE_USAGE_INVENTORY.md` contains older auth-only
retention advice and outdated table mappings; treat it as historical leads, not
current instructions or proof of deployed state.

### Live GCS check — September 17

Read-only bucket/list verification succeeded using gcloud. Bucket is in
US-CENTRAL1 with public access prevention enforced, uniform bucket access,
versioning enabled and seven-day soft-delete retention. Current listed objects:

| Prefix             | Objects |
| ------------------ | ------: |
| client-documents   |       1 |
| doula-documents    |       1 |
| contracts          |      30 |
| contract-templates |      17 |
| profile-pictures   |      28 |
| Total              |      77 |

No object names or contents were emitted or persisted. These counts are not
source/destination reconciliation and do not prove complete migration.

The existing comparison script was executed WITHOUT `--apply`. It failed with
Google `invalid_grant` / `invalid_rapt` reauthentication error before producing
comparison totals. gcloud CLI authentication works, but the application default
credentials used by the Node GCS SDK require separate reauthentication via
`gcloud auth application-default login`. No copy/delete was performed. Retry
read-only comparison after that step; confirm the configured source project
matches production before interpreting its results as production evidence.
