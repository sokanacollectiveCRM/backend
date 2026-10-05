# October 12 execution baseline

Recorded: September 17, 2026. This directory preserves the supplied backlog and
tracks evidence separately from assumptions. No application refactor or database
migration has been performed as part of this baseline.

## Updated release scope

Supabase independence is now required before October 12, superseding the earlier
deferral. See [shutdown plan](supabase-shutdown-plan.md) and the supplied
[S1-S11 backlog](supabase-shutdown-backlog.md). Preserve data and verify staging
before changing production credentials or shutting down the project.

## Artifacts

- `production-backlog.md`: exact copy of the supplied backlog, including task
  IDs.

Stale SignNow/DocuSign source-search TSV snapshots were removed after those
adapters were deleted.

## Epic 1 status

| Task                  | Status                                               | Evidence / remaining work                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Backend revision  | Verified service metadata; source provenance pending | Serving revision, traffic, image digest, environment names and safe flags recorded in `production-deployment-verification.md`. Build/source provenance and effective image defaults remain to be verified. |
| 1.2 Frontend app      | Partial                                              | Live service URL, serving revision and image digest verified. Build provenance and compiled API URL remain unverified.                                                                                     |
| 1.3 Schema baseline   | Pending                                              | No production schema export or row-count query executed. Checked-in migrations are not the deployed schema.                                                                                                |
| 1.4 Supabase usage    | Partial                                              | Candidate reference index generated; active/legacy/removable classifications require call-chain and deployed-flag verification.                                                                            |
| 1.5 Routes/callers    | Partial                                              | Mount families below and candidate route index available; full method/path/controller/auth/caller matrix remains to be completed.                                                                          |
| 1.6 Financial writers | Partial                                              | Candidate mutation index generated; trace all callers, jobs, broker paths, root scripts and external workers before closing.                                                                               |
| 1.7 Providers         | Pending business/production verification             | Native signing, legacy signing, QuickBooks and Stripe code exist; availability in source does not select the production workflow.                                                                          |

No Epic 1 acceptance criterion is marked complete from configuration alone.

## Deployment evidence

Backend local Git HEAD: `a0a21f763678d1cd52da1d922935426001731afc`. The
workspace has pre-existing modifications and untracked files. This HEAD is not a
claim about the running service or the complete local source state.

| Source                             | Configuration evidence                                                                                                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend `cloudbuild.yaml`          | Service `sokana-private-api`, region `us-central1`; image under `cloud-run-source-deploy/backend/sokana-private-api:$COMMIT_SHA`; npm install/build/test/security-smoke gate before deployment. Project supplied through `$PROJECT_ID`.              |
| Backend `scripts/deploy.sh`        | Project `sokana-private-data`, region `us-central1`, same service; image `backend-repo/api:latest`; separate build/deploy path, without the explicit Cloud Build test gate in this script.                                                           |
| CRM `frontend-crm/cloudbuild.yaml` | Service `sokana-front-end`, region `us-central1`; Docker image built with frontend substitutions; auth substitution defaults to `identity`. Backend URL substitution is empty in the checked-in file and must be confirmed from actual build inputs. |
| Backend `package.json`             | Build `tsc` plus alias/assets steps; production start `node dist/cloudrun.js`.                                                                                                                                                                       |
| CRM `package.json`                 | Build `tsc -p tsconfig.build.json && vite build`.                                                                                                                                                                                                    |

Do not run deployment scripts for inventory. Resolve which deployment path
produced each serving revision. Record traffic percentages, not only the latest
ready revision, since those can differ.

### Read-only cloud verification after local reauthentication

Update: reauthentication succeeded. Both service and serving-revision lookups
completed successfully; see `production-deployment-verification.md`. The failure
below is historical, not an active blocker.

The metadata lookup was attempted and returned:
`Reauthentication failed. cannot prompt during non-interactive execution.` This
is an authentication blocker, not an automatic approval rejection.

Jerry completed interactive reauthentication; no further login is currently
required.

```sh
gcloud run services describe sokana-private-api \
  --project=sokana-private-data --region=us-central1 \
  --format='json(metadata.name,status.url,status.traffic,status.latestReadyRevisionName,spec.template.metadata.name,spec.template.spec.containers.image)'

gcloud run services describe sokana-front-end \
  --project=sokana-private-data --region=us-central1 \
  --format='json(metadata.name,status.url,status.traffic,status.latestReadyRevisionName,spec.template.metadata.name,spec.template.spec.containers.image)'
```

Document configuration names and secret references without copying credential
values. Capture safe feature values for `AUTH_PROVIDER`,
`NATIVE_CONTRACTS_ENABLED`, `CONTRACT_OUTBOX_ENABLED`, `FEATURE_QUICKBOOKS`,
`FEATURE_STRIPE`, `FEATURE_EMAIL`, and intake feature flags. Record the values
for every revision receiving traffic.

## Route and data ownership starting points

| Mounted family                                             | Source                                             | Known CRM caller / scope requirement                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/auth`, `/login`                                          | `server.ts`, `authRoutes.ts`                       | Auth UI and UserContext; resolve identity first, membership next. Preserve token transports.                         |
| `/clients`, `/client`, `/api/clients`, `/api/client`       | `clientRoutes.ts`                                  | `api/services/clients.service.ts`; tenant plus client/assignment authorization, including PHI and billing subroutes. |
| `/api/doulas`                                              | `doulaRoutes.ts`                                   | `api/doulas/doulaService.ts`; tenant, provider ownership and active/historical assignment rules.                     |
| `/api/admin`, `/api`                                       | `adminRoutes.ts`, `doulas.ts`                      | Provider/team/admin UI; tenant membership and resource ownership.                                                    |
| `/api/contracts`, `/signing`                               | Native contracts composition, gated in `server.ts` | Contract/public-signing UI; tenant from verified invitation/session for public signing.                              |
| `/api/contract`, `/api/contract-signing`                   | Legacy contract/signing routers                    | Trace legacy callers; tenant-bound agreement mapping.                                                                |
| `/contracts`, `/api/contracts`                             | `contractTemplateRoutes.ts`                        | Templates/contract UI; explicit tenant-owned versus platform template policy.                                        |
| `/api/payments`, `/api/invoices`, `/api/billing`           | Payment/invoice/billing routers                    | Financial invoice APIs and billing portal; tenant and billing-account ownership.                                     |
| `/api/payment-methods`                                     | `paymentMethodRoutes.ts`                           | `clients.service.ts`, `quickbooksPayments.ts`; client ownership plus tenant connection.                              |
| `/quickbooks`, `/api/quickbooks`                           | Flag-gated QuickBooks routers                      | Integration and invoice APIs; tenant-bound OAuth, provider connection and webhook identity.                          |
| `/api/dashboard`, `/api/financial`                         | Dashboard/financial routers                        | Reporting UI; tenant-filtered aggregates, joins and exports.                                                         |
| `/requestService`, `/email`, `/users`, `/api/pdf-contract` | Respective routers mounted by `server.ts`          | Trace public intake, email, user and PDF callers individually; public intake requires trusted tenant resolution.     |

Include aliases, anonymous endpoints, middleware ordering, dynamic `require`
mounts and feature gates in the final route matrix. The separate PHI broker also
needs its own route/query inventory. Health endpoints do not need tenant data.

## High-priority writer tracing

- Hours: `doulaController` -> `userUseCase` -> `supabaseUserRepository` -> Cloud
  SQL `hours`. Trace alternate user/controller entry points before extraction.
- Clients and assignments: `cloudSqlClientRepository`,
  `cloudSqlDoulaAssignmentService`, `cloudSqlTeamService`, request intake and
  PHI broker.
- Agreements: native repositories/services/outbox, legacy contract services and
  native completion. Preserve existing signing artifacts and completion dedupe.
- Invoices/deposits: `contractSignatureCompletionService`,
  `installmentInvoiceService`, invoice write repository and QuickBooks invoice
  helpers.
- Payments: payment routes, `simplePaymentService`, Stripe implementations,
  QuickBooks webhooks and reconciliation. Distinguish mounted paths from unused
  files.
- Cards: `customerPaymentMethodService`, payment-method repository and provider
  adapters.
- Supabase: actual `.from()` paths still occur in legacy contract services and
  request repository methods. Class names alone do not identify the database
  used.

## Dependency corrections for execution

1. Keep the supplied task IDs. Track work by dependencies, not epic number
   alone.
2. Deliver 3.3 (transactions) and 12.1 (common audit API) before 6.6, 9.2 and
   payout status mutations. Implement relevant audit events with each workflow.
3. Build tenant resolver/access control together with 4.9. A nullable tenant
   column by itself is not isolation.
4. Add idempotency/uniqueness and recovery tests alongside financial writes,
   before scheduled execution is enabled.
5. Characterization tests start before extraction; PostgreSQL concurrency and
   isolation tests accompany schema changes. Epic 15 is not a final-only phase.
6. For 9.6, model invoice lifecycle, delivery state and payment state
   separately. A failed payment does not unfinalize an invoice. Preserve the
   listed UI states as projections instead of one contradictory enum.
7. A payout links to approved source work; invoice linkage can be added when an
   invoice exists. Payout eligibility follows decision 2.7, without assuming
   collection is required or creating a Care Operations dependency on Billing.
8. Implement cache invalidation on session/tenant-context change; defer tenant
   switching UI and self-service onboarding as requested.

The requested `src/modules` destination supersedes the older `src/features`
packaging target for new approved migration slices. Retain existing feature
packages behind public adapters until their slice is moved; preserve their
domain/application/adapter separation rather than flattening working code.

## Business decision gate

All seven Epic 2 decisions remain unconfirmed. Store decision, approver,
effective date, rule version and example expected totals for each. Do not infer
approved rates or deposit treatment from an old component or example contract.

As of September 17 the original September 15-17 inventory window is ending.
Rebaseline dates after cloud/schema access and business decisions are available;
do not claim the earlier schedule is still on track. Preserve the October 6
structural freeze and October 12 testing target, reducing optional file moves
first.

## Next gate

Complete the production metadata/schema baseline and route/writer
classifications, then begin module shells and tenant schema design. No
production migrations, charges, invoice issuance or deployment were performed by
this inventory work.
