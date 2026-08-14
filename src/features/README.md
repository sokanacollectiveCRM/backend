# Feature packages

This directory is the home for **feature-first** business capabilities in the Sokana backend modular monolith.

PR 1 documents the intended packaging and dependency rules only. It does **not** move production code, create empty feature packages, change routes, or alter runtime behavior. Existing legacy paths under `src/controllers`, `src/services`, `src/repositories`, and `src/routes` remain authoritative until a later, explicitly approved migration slice.

## Architecture intent

- Organize by Sokana business capability (`intake`, `portal`, `clients`, …), not by technical layer at the top level.
- Keep a **functional core** (domain + application) free of Express, databases, vendor SDKs, and raw env access.
- Put I/O and frameworks in **adapters** (`http`, `infrastructure`) owned by the feature.
- Compose dependencies at the edge (`bootstrap`); do not bury wiring inside domain rules.

## Where new business code goes

- **New business code belongs under `src/features/<feature>`.**
- **Do not add new global controllers, services, repositories, or routes** under the legacy top-level folders.
- Prefer extending or extracting into the owning feature package instead of growing the global layer further.
- Legacy global modules may remain until their vertical slice is migrated; they are not a place for new capability work.

## Package layout (per feature)

Each feature package uses these layers:

| Layer | Role |
| --- | --- |
| `domain/` | Pure rules, types, validation/normalization, domain errors. No Express, DB, SDKs, or `process.env`. |
| `application/` | Use cases / application services. Depend on small ports (interfaces), not concrete adapters. |
| `http/` | Route handlers, request/response mapping, Zod (or equivalent) at the edge. |
| `infrastructure/` | Persistence, vendor clients, and other I/O adapters that implement application ports. |

### Public feature entrypoints

- Each feature exposes a supported application/domain API via its package `index.ts` (and nested public barrels as needed).
- Cross-feature consumers **must** import only that public API.
- Cross-feature consumers **must not** import another feature’s `infrastructure/` (or other internal modules) directly.
- Vendor names (QuickBooks, SignNow, DocuSign, Stripe, Supabase, …) belong under the owning feature’s `infrastructure/`, not as top-level navigation categories.

## Dependency rules

Allowed direction (inward):

```text
http → application → domain
infrastructure → application ports / domain types
```

Forbidden:

- `domain` importing Express, DB clients, vendor SDKs, HTTP frameworks, or env/config loaders
- `application` depending on concrete infrastructure adapters (wire those in composition)
- Feature A importing Feature B’s infrastructure or internal HTTP modules
- New business logic landing in global `controllers` / `services` / `repositories` / `routes`

## Bootstrap

- `bootstrap` (target location under `src/bootstrap`) **only assembles dependencies and starts the application**.
- It contains no business rules, domain validation, or use-case logic.
- Composition roots wire ports to adapters and mount HTTP routes; feature packages own the behavior.

Until bootstrap is extracted in a later milestone, the existing app entry remains the temporary composition edge. Do not move composition until the first feature slices are stable.

## Shared code

- Shared modules must stay **domain-neutral**.
- Allowed shared concerns: config, HTTP utilities, database access helpers, logging, security, and testing mechanisms.
- Shared code must not encode intake-, portal-, billing-, or other feature-specific business rules.
- Prefer a port or a public feature operation over a shared “god” helper that knows multiple domains.

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

- Public route/controller façade remains: `POST /requestService/requestSubmission` → `RequestFormController.createForm`.
- Domain normalize is always used; write path defaults to legacy repository via the service façade.
- `INTAKE_USE_FEATURE_PACKAGE=true` serves writes through the application use case.
- `INTAKE_SHADOW_COMPARE=true` logs normalize-slice parity (no PHI dump) for the monitored window.
- Abuse protection: honeypot + IP/email rate limits + optional `Idempotency-Key` + soft email dedupe (`intakeAbuseProtection`). Rate limits/soft-dedupe are on outside Jest; set `INTAKE_ABUSE_ENFORCE=true` to exercise them in tests. Apply migration `add_intake_rate_limits_and_idempotency.sql` before multi-instance deploys.
- Compatibility shim: `src/intake/requestSubmissionDto.ts` re-exports domain helpers.

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
    documents/{domain,application,http,infrastructure}
  shared/{config,database,http,logging,security,testing}
```

Migrate one capability at a time: stabilize → characterize → extract pure rules → introduce ports → adapters → switch one endpoint → monitor → remove the old path later.

## Existing content under `src/features`

Some legacy paths already live here (for example invoices/QuickBooks UI or service folders). Treat those as historical placements. New work should follow the feature-package rules above; do not use this tree as a dumping ground for unrelated global modules.
