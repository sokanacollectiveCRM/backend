# Feature packages

This directory is the home for **feature-first** business capabilities in the
Sokana backend modular monolith.

PR 1 documents the intended packaging and dependency rules only. It does **not**
move production code, create empty feature packages, change routes, or alter
runtime behavior. Existing legacy paths under `src/controllers`, `src/services`,
`src/repositories`, and `src/routes` remain authoritative until a later,
explicitly approved migration slice.

## Architecture intent

- Organize by Sokana business capability (`intake`, `portal`, `clients`, …), not
  by technical layer at the top level.
- Keep a **functional core** (domain + application) free of Express, databases,
  vendor SDKs, and raw env access.
- Put I/O and frameworks in **adapters** (`http`, `infrastructure`) owned by the
  feature.
- Compose dependencies at the edge (`bootstrap`); do not bury wiring inside
  domain rules.

## Where new business code goes

- **New business code belongs under `src/features/<feature>`.**
- **Do not add new global controllers, services, repositories, or routes** under
  the legacy top-level folders.
- Prefer extending or extracting into the owning feature package instead of
  growing the global layer further.
- Legacy global modules may remain until their vertical slice is migrated; they
  are not a place for new capability work.

## Package layout (per feature)

Each feature package uses these layers:

| Layer             | Role                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `domain/`         | Pure rules, types, validation/normalization, domain errors. No Express, DB, SDKs, or `process.env`. |
| `application/`    | Use cases / application services. Depend on small ports (interfaces), not concrete adapters.        |
| `http/`           | Route handlers, request/response mapping, Zod (or equivalent) at the edge.                          |
| `infrastructure/` | Persistence, vendor clients, and other I/O adapters that implement application ports.               |

### Public feature entrypoints

- Each feature exposes a supported application/domain API via its package
  `index.ts` (and nested public barrels as needed).
- Cross-feature consumers **must** import only that public API.
- Cross-feature consumers **must not** import another feature’s
  `infrastructure/` (or other internal modules) directly.
- Vendor names (QuickBooks, Stripe, Supabase, …) belong under the owning
  feature’s `infrastructure/`, not as top-level navigation categories.

## Dependency rules

Allowed direction (inward):

```text
http → application → domain
infrastructure → application ports / domain types
```

Forbidden:

- `domain` importing Express, DB clients, vendor SDKs, HTTP frameworks, or
  env/config loaders
- `application` depending on concrete infrastructure adapters (wire those in
  composition)
- Feature A importing Feature B’s infrastructure or internal HTTP modules
- New business logic landing in global `controllers` / `services` /
  `repositories` / `routes`

## Bootstrap

- `bootstrap` (target location under `src/bootstrap`) **only assembles
  dependencies and starts the application**.
- It contains no business rules, domain validation, or use-case logic.
- Composition roots wire ports to adapters and mount HTTP routes; feature
  packages own the behavior.

Until bootstrap is extracted in a later milestone, the existing app entry
remains the temporary composition edge. Do not move composition until the first
feature slices are stable.

## Shared code

- Shared modules must stay **domain-neutral**.
- Allowed shared concerns: config, HTTP utilities, database access helpers,
  logging, security, and testing mechanisms.
- Shared code must not encode intake-, portal-, billing-, or other
  feature-specific business rules.
- Prefer a port or a public feature operation over a shared “god” helper that
  knows multiple domains.

## Target intake package (`src/features/intake`)

Request intake is the **first** structural slice (PR 8). Ownership:

```text
src/features/intake/
  domain/           # submission DTO rules, pure validation & normalization
  application/      # submitPublicRequestForm use case + ports
  http/             # public contract constants (URL/message)
  infrastructure/   # LegacyRequestFormRepositoryAdapter
  index.ts          # public feature entrypoints
```

Runtime notes:

- Public route/controller façade remains:
  `POST /requestService/requestSubmission` → `RequestFormController.createForm`.
- Domain normalize is always used; write path defaults to legacy repository via
  the service façade.
- `INTAKE_USE_FEATURE_PACKAGE=true` serves writes through the application use
  case.
- `INTAKE_SHADOW_COMPARE=true` logs normalize-slice parity (no PHI dump) for the
  monitored window.
- Abuse protection: honeypot + IP/email rate limits + optional
  `Idempotency-Key` + soft email dedupe (`intakeAbuseProtection`). Rate
  limits/soft-dedupe are on outside Jest; set `INTAKE_ABUSE_ENFORCE=true` to
  exercise them in tests. Apply migration
  `add_intake_rate_limits_and_idempotency.sql` before multi-instance deploys.
- Compatibility shim: `src/intake/requestSubmissionDto.ts` re-exports domain
  helpers.

## Portal package (`src/features/portal`)

Portal eligibility is the **second** structural slice. The domain owns every
eligibility decision. The service only loads facts and saves the result:

```text
src/features/portal/
  domain/eligibility.ts         # billing path, blockers, eligibility, allowed actions
  application/ports.ts          # facts reader, card reader, readiness store
  application/portalEligibility.ts  # compute+persist, batch, invite eligibility
  infrastructure/               # Cloud SQL facts, QuickBooks card, readiness store
  composition.ts                # wires ports to adapters
  index.ts                      # public feature entrypoints
```

Runtime notes:

- Rules moved out of `src/constants/portalEligibility.ts`. That file is now a
  re-export shim. Existing callers keep their import paths.
- New code should import from `src/features/portal`.
- Domain decides billing path, blockers, deposit/contract facts, paid
  installment statuses, the signed-contract status, card-on-file fact mapping,
  force overrides, invite blocker copy, the list cache-miss snapshot, allowed
  actions, and lock/unlock transitions.
- `PortalEligibilityService` is a thin façade over the application use cases.
  Callers keep `src/services/portalEligibilityService` and its methods.
- `composition.ts` is not exported from `index.ts`: the readiness repository
  imports the barrel, so exporting adapters there would create a cycle.
- Behavior is pinned by
  `src/__tests__/portalEligibilityServiceCharacterization.test.ts`.
- Client list/detail fields stay the same: `is_eligible`, `portal_blockers`,
  `primary_portal_blocker`, `allowed_actions`, and the payment-authorization
  flags.

## Clients package (`src/features/clients`)

Third structural slice: client status changes and the backend QuickBooks
customer link.

```text
src/features/clients/
  domain/clientStatus.ts         # status input, conversion statuses, matched_at rule
  domain/quickBooksCustomer.ts   # payload, default names, identity rule, link methods
  application/ports.ts           # QuickBooks customer directory, link store
  application/linkClientToQuickBooksCustomer.ts  # stored id → email → name → create
  infrastructure/                # QuickBooks Online lookups, Cloud SQL qbo_customer_id write
  composition.ts                 # wires ports to adapters
  index.ts                       # public feature entrypoints
```

Runtime notes:

- `PUT /clients/status` stays in `clientController`; it uses the domain rules.
- `services/customer/syncMatchedClientToQuickBooks.ts` and
  `buildCustomerPayload.ts` are façades over this package.
- The frontend still runs its own QuickBooks sync on `matched`. Remove it only
  after backend idempotency/outbox exists.
- Behavior is pinned by
  `src/__tests__/clientStatusQuickBooksSyncCharacterization.test.ts` and
  `src/__tests__/syncMatchedClientToQuickBooks.test.ts`.

## Matching package (`src/features/matching`)

Fourth structural slice: the decisions for assigning a doula to a client.

```text
src/features/matching/
  domain/assignment.ts                 # service catalog, role, window, messages
  application/ports.ts                 # assignment store, availability, client/doula lookup
  application/assignDoulaOnClient.ts   # POST /clients/:id/assign-doula
  application/matchDoulaForAdmin.ts    # POST /admin/assignments/match
  infrastructure/                      # Cloud SQL assignment store, doula availability
  index.ts                             # public feature entrypoints
```

Runtime notes:

- Both routes keep their controllers. Each controller passes its existing
  services in as ports and maps the result to the same response.
- The two routes still differ on purpose: client assign checks availability and
  returns 409 for an existing assignment; admin match requires status `matching`
  and an existing doula, returns 400 for an existing assignment, and sends match
  email after the write.
- `constants/assignmentServices.ts` and the role helper exported from
  `services/cloudSqlDoulaAssignmentService.ts` forward to this package.
- `CloudSqlDoulaAssignmentService` and `DoulaAvailabilityService` live in
  `infrastructure/`. Their old `src/services/` paths are re-export shims, so
  existing imports and Jest mocks keep working.
- Behavior is pinned by
  `src/__tests__/matchingAssignmentCharacterization.test.ts`.

## Contracts package (`src/features/contracts`)

Fifth structural slice: native signing, invitations, signed-copy email, the
portal signed-contract fact, plus the live template and generate-contract
façades.

```text
src/features/contracts/
  domain/                 # pricing, status, payload normalize, billing-schedule rule
  application/            # draft/send, invitations, signing sessions, rate limits
  http/                   # native + legacy generate-contract/template/postpartum routes
  infrastructure/         # Cloud SQL, GCS PDF, outbox, completion email
  composition.ts          # wires ports to adapters; not exported from the barrel
  index.ts                # public feature entrypoints
```

Runtime notes:

- Mounts are unchanged in `src/server.ts`: `/api/contracts`,
  `/api/clients/me/contracts`, `/signing`,
  `/api/contract-signing/generate-contract`, `/api/contract/postpartum/*`,
  `/contracts/templates`.
- Old technical-role folders (`controllers/`, `services/`, `repositories/`,
  `routes/`, `pdf/`, `validation/`) and the previous global
  controller/route/service paths are re-export shims, so existing imports and
  Jest mocks keep working.
- `composition.ts` is not exported from `index.ts`.
- Signed-copy email and the portal `force_contract_signed` fact still run from
  the completion outbox. Portal eligibility still reads that fact.
- Generate-contract returns `contractId` and `invitationSent`. There is no
  SignNow or DocuSign adapter.
- Behavior is pinned by `src/__tests__/contractsFeatureCharacterization.test.ts`
  and the existing `src/features/contracts/__tests__` suites.

## Billing package (`src/features/billing`)

Sixth structural slice, first step: the mounted billing portal.

```text
src/features/billing/
  http/            # /api/billing contract list, detail, PDF, download, reminder
  infrastructure/  # Cloud SQL limited views, GCS download, reminder email
  index.ts         # public feature entrypoints
```

Runtime notes:

- Mount is unchanged in `src/server.ts`: `/api/billing`.
- Old `src/routes/billingRoutes.ts` and the three `src/services/` helpers are
  re-export shims.
- Response wrappers, roles (`admin`, `billing`), and PDF headers stay the same.
- `/api/payments`, `/api/invoices`, `/api/financial`, and `/api/payment-methods`
  stay on their current routers until a later step.
- QuickBooks HTTP (`/quickbooks`, `/api/quickbooks`, `/quickbooks/customers`)
  now lives in this package. The old route and controller paths are shims.

## Moved behind existing mounts

These live controllers and routes now sit in their feature packages. The old
`src/controllers`, `src/routes`, and `src/usecase` files re-export them, and
`src/server.ts` mounts are unchanged.

- clients: client API and client billing schedule
- portal: portal invite controller
- intake: public request-form controller and route
- doulas: doula dashboard controller and admin doula list
- auth: login, session, and password recovery
- billing: QuickBooks OAuth, customers, and invoice webhook
- users: user profile and hours (`/users`)
- admin: doula invite, matching, and the admin router (`/api/admin`)
- email: approval and team-invite HTTP (`/email`). Mail transport stays in
  `src/services/emailService`.
- dashboard: stats and due-date calendar (`/api/dashboard`). Handlers live in
  the route module.
- Behavior is pinned by `src/__tests__/billingRoutes.test.ts`.

## Target tree (incremental, not big-bang)

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
    users/{domain,application,http,infrastructure}
    admin/{domain,application,http,infrastructure}
    email/{domain,application,http,infrastructure}
    dashboard/{domain,application,http,infrastructure}
    documents/{domain,application,http,infrastructure}
  shared/{config,database,http,logging,security,testing}
```

Migrate one capability at a time: stabilize → characterize → extract pure rules
→ introduce ports → adapters → switch one endpoint → monitor → remove the old
path later.

## Existing content under `src/features`

Some legacy paths already live here (for example invoices/QuickBooks UI or
service folders). Treat those as historical placements. New work should follow
the feature-package rules above; do not use this tree as a dumping ground for
unrelated global modules.
