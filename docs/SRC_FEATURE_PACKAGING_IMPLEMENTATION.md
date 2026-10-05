# Implementation: package backend source by business feature

Status: **Planned — not implemented**

## Objective

Reorganize `src/` around business capabilities while preserving API behavior,
authorization, database behavior, and deployment boundaries. Keep one backend;
this task does not introduce separate services or npm packages.

Existing cleanup changes and the HIPAA deployment are separate work. Do not
bundle production behavior changes or database migrations into directory moves.

## Target layout

```text
src/
  app/                         # Startup, route mounting, dependency wiring, health
  features/
    identity/                  # Authentication, sessions, MFA, accounts, providers
    intake/                    # Submissions, review, abuse protection, notifications
    clients/                   # Profiles, lifecycle, sensitive data, directory
    workforce/                 # Staff profiles, onboarding, availability, credentials
    assignments/               # Matching, lifecycle, booking requests, access policy
    care/                      # Activities, notes, birth outcomes, service hours
    portal/                    # Invitations, eligibility, self-service composition
    contracts/                 # Agreements, templates, signing, PDFs, events, providers
    billing/                   # Insurance, customers, invoices, payments, reconciliation
    documents/                 # Client/staff files, access, storage
    reporting/                 # Dashboards and operational exports
  shared/
    config/
    database/
    http/
    logging/
    security/
    email/
    runtime/
```

Create subfolders only when actual code needs them. Small features can start
with `index.ts`, `routes.ts`, named operation files, `repository.ts`,
`accessPolicy.ts`, and colocated tests. Do not reproduce every global technical
layer inside every feature.

## Subtask 1 — Establish the baseline and migration inventory

- [ ] Record the starting commit and separate existing uncommitted cleanup work.
- [ ] Inventory all tracked source files, imports, route mounts, runtime
      entrypoints, scripts, and build/test/deployment references.
- [ ] Assign each file a destination, split requirement, or removal candidate.
- [ ] Run the build, full tests, security smoke tests, and repository CI lint
      gates.
- [ ] Document any pre-existing failures before moving code.
- [ ] Reconcile `src/features/README.md` with this plan, including shallow
      layouts.

Done when every source file has an owner and the baseline is reproducible.

## Subtask 2 — Separate generated, frontend, and operational files

- [ ] Review the 82 same-name `.js`/`.ts` pairs identified during inventory.
- [ ] Verify imports, module resolution, scripts, and production loading before
      removing stale JavaScript copies; retain genuinely independent JS modules.
- [ ] Review `features/invoices/InvoicesPage.tsx` for transfer to the frontend
      or archival; verify whether equivalent functionality already exists there.
- [ ] Move `tools/PdfMapper.tsx` to developer tooling or its appropriate
      frontend.
- [ ] Move `src/scripts/`, database inspection/setup utilities, and manual test
      scripts out of runtime source and update invocation paths.
- [ ] Move contract-processing documentation from `utils/` to `docs/`.
- [ ] Separate signature-generation tooling from contract runtime assets.

Done when runtime source contains supported backend code and required assets,
and no removed file is still needed by a supported command.

## Subtask 3 — Establish app composition and narrow shared modules

- [ ] Consolidate `cloudrun.ts`, `server.ts`, `index.ts`, and `api/index.*`
      duties under `app/`, preserving necessary entrypoint shims during
      migration.
- [ ] Move generic environment parsing to `shared/config/`.
- [ ] Move connection pooling and generic transaction support to
      `shared/database/`.
- [ ] Move response envelopes, generic validation, and Express augmentation to
      `shared/http/`.
- [ ] Move logging and safe logging to `shared/logging/`.
- [ ] Keep only generic crypto/webhook mechanisms in `shared/security/`.
- [ ] Move mail transport to `shared/email/`; keep message content
      feature-owned.
- [ ] Move generic temporary-path helpers to `shared/runtime/`.
- [ ] Classify generic errors separately from feature-specific errors.
- [ ] Update package scripts, TypeScript/Jest configuration, Dockerfile, Cloud
      Build, and asset-copy paths when entrypoints move.

Done when application wiring is explicit and shared modules contain no
feature-specific business rules.

## Subtask 4 — Complete intake packaging

- [ ] Consolidate `features/intake/` and `intake/`.
- [ ] Move request-form controller, routes, service, model, repository, and
      DTOs.
- [ ] Include normalization, review/approval operations, abuse protection,
      referral constants, and staff notifications.
- [ ] Move intake tests alongside the feature.
- [ ] Preserve endpoint contracts and existing feature-flag behavior.
- [ ] Remove compatibility re-exports after all consumers migrate.

Done when intake has one authoritative package and unchanged submission
behavior.

## Subtask 5 — Package identity and account access

- [ ] Move auth controller/routes/use case, auth interfaces, and provider
      adapters.
- [ ] Move Identity Platform token verification, identity linking, MFA, and
      crypto.
- [ ] Move session cookies, auth transport telemetry, and account-state checks.
- [ ] Move login/MFA request schemas from `security/requestSchemas.ts`.
- [ ] Separate identity/account fields from workforce profile fields in User
      types.
- [ ] Preserve legacy Supabase compatibility until its cutover is independently
      ready.
- [ ] Colocate identity tests and verify disabled-account and session behavior.

Done when identity owns caller authentication and account state. Record-level
business authorization remains with each owning feature.

## Subtask 6 — Package workforce and assignments

- [ ] Move staff/doula profiles, onboarding, team services, demographics, and
      availability into `workforce/`.
- [ ] Keep credential requirements and completeness rules in workforce; consume
      file metadata through the documents public API.
- [ ] Move Cloud SQL assignment operations, matching, booking requests,
      lifecycle, assignment constants, and notifications into `assignments/`.
- [ ] Move active-assignment checks into the assignments public API.
- [ ] Split `adminController.ts`, `doulasController.ts`, and `doulasService.ts`
      by operation instead of moving each whole file into one feature.
- [ ] Split relevant portions of `doulaController.ts`, user routes/use cases,
      and mixed user repositories.
- [ ] Verify assignment revocation, availability protection, and role
      restrictions.

Done when staff profile management and client assignment management have
separate ownership without duplicated assignment authorization.

## Subtask 7 — Package clients and care

- [ ] Move client demographics, contact/home profiles, lifecycle, and directory
      operations into `clients/`.
- [ ] Move PHI-specific fields and the PHI broker adapter under clients.
- [ ] Move activities, notes, birth outcomes, and hours into `care/`.
- [ ] Move Activity/Note/Hours models, activity DTOs/mappers, repositories, and
      tests.
- [ ] Split `clientController.ts`, `clientUseCase.ts`,
      `cloudSqlClientRepository.ts`, and mixed legacy repositories along
      business boundaries.
- [ ] Keep billing fields in billing, documents in documents, matching in
      assignments, and CSV export composition in reporting.
- [ ] Preserve field minimization, ownership checks, and client visibility
      rules.

Done when profile management and care delivery can evolve independently while
retaining existing access protections.

## Subtask 8 — Package documents

- [ ] Move client/staff file metadata, upload/download/delete operations, and
      access rules.
- [ ] Move document repositories, upload services, ID resolution, and related
      DTOs.
- [ ] Move GCS storage and temporary legacy storage adapters beneath documents.
- [ ] Keep profile-picture storage mechanisms here; profile changes remain owned
      by clients or workforce.
- [ ] Keep signed-contract rendering and integrity evidence in contracts.
- [ ] Verify signed URLs, ownership, role access, and metadata compatibility.

Done when file operations have one owner without absorbing workforce credential
rules or contract signing workflows.

## Subtask 9 — Consolidate contracts

- [ ] Extend the existing `features/contracts/` package rather than creating
      another.
- [ ] Consolidate legacy contract controllers, routes, services, interfaces,
      models, use cases, and compatibility adapters.
- [ ] Include agreement calculations, postpartum terms, templates, signing
      sessions, invitations, events, completion notifications, and outbox
      delivery.
- [ ] Consolidate PDF utilities, coordinates, fonts, and required signature
      assets.
- [x] Native signing only; SignNow and DocuSign adapters removed.
- [ ] Keep agreement pricing terms in contracts and payment collection in
      billing.
- [ ] Preserve signing URLs, session semantics, PDF integrity, and event
      behavior.

Done when contracts has one public API and no competing authoritative
implementation.

## Subtask 10 — Consolidate billing

- [ ] Consolidate `billing/`, financial controllers/routes, and billing-related
      services.
- [ ] Package insurance profiles, accounting customers, invoices, payments,
      payment methods, schedules, reconciliation, and reminders.
- [ ] Move `services/customer/`, `services/invoice/`, `services/payments/`, and
      financial repositories under billing.
- [ ] Move QuickBooks OAuth from `services/auth/` to billing provider
      authorization.
- [ ] Move `api/qbo/`, QuickBooks/Stripe config, clients, tokens, and webhooks
      here.
- [ ] Move invoice PDF generation and billing URL helpers into billing.
- [ ] Make billing contract-download workflows consume the contracts public API.
- [ ] Preserve admin/billing restrictions, client ownership, tokenized card
      handling, reconciliation, and invoice/payment idempotency.

Done when financial behavior is feature-owned and independent of global service
folders.

## Subtask 11 — Package portal and reporting

- [ ] Move portal invitations, eligibility, readiness repository, and response
      mapping.
- [ ] Compose client self-service from public client/billing/contract/document
      operations.
- [ ] Move dashboard queries and authorized operational/client exports into
      reporting.
- [ ] Leave financial reconciliation and its CSV export in billing.
- [ ] Remove duplicated domain rules and direct imports of other features'
      repositories.
- [ ] Preserve existing response shapes, eligibility decisions, and export
      authorization.

Done when portal/reporting coordinate other features without becoming alternate
owners of their business rules.

## Subtask 12 — Consolidate migration and operational ownership

- [ ] Inventory root `migrations/`, `src/db/migrations/`, and
      `supabase/migrations/`.
- [ ] Distinguish applied history, active migrations, diagnostics, fixtures, and
      experiments.
- [ ] Establish one documented migration entrypoint/history; retain
      provider-specific historical groupings where necessary.
- [ ] Do not rename migration identifiers or change SQL semantics without
      checking applied-migration tracking and deployment references.
- [ ] Move inspection SQL to `scripts/sql/` and fixtures to their test/tooling
      owner.
- [ ] Update migration runners and runbooks after any path changes.
- [ ] Preserve the separately deployed `phi-broker` security/deployment
      boundary.

Done when migration execution is unambiguous and no historical migration is lost
or accidentally re-executed. This subtask does not authorize production SQL
execution.

## Subtask 13 — Remove legacy global layers and enforce boundaries

- [ ] Distribute remaining constants, entities, DTOs, mappers, types,
      interfaces, and utilities to their feature owners.
- [ ] Split `types.ts` and global authorization policies; keep generic
      primitives shared.
- [ ] Split email controller operations among intake, workforce, assignments,
      contracts, and billing; retain only transport in shared email.
- [ ] Move feature tests beside their code and cross-feature/security acceptance
      tests to root `tests/`; update Jest discovery and security-smoke commands.
- [ ] Move production debug routes to explicit app diagnostics or developer
      tooling according to their current supported use.
- [ ] Remove unused global controllers/services/repositories/routes/usecase
      folders and compatibility shims only after verifying all consumers.
- [ ] Remove Supabase connection/adapters only after all actual consumers are
      migrated.
- [ ] Expose feature public APIs through `index.ts`; prevent cross-feature
      imports of private repositories/provider implementations.
- [ ] Add appropriate import-boundary checks and update architecture
      documentation.

Done when every remaining runtime file belongs to app composition, a business
feature, or a narrowly shared mechanism.

## Validation and delivery checklist for every migration slice

- [ ] Keep the slice limited to one feature or dependency boundary.
- [ ] Update imports, runtime wiring, manual commands, asset paths, and
      documentation.
- [ ] Verify moved assets retain their original contents.
- [ ] Run relevant behavior/security regression tests and the production build.
- [ ] Run required lint/format checks; run the full suite and security smoke for
      broad wiring changes and before completing the overall reorganization.
- [ ] Confirm API paths, response contracts, auth checks, and environment
      behavior remain unchanged unless separately approved as a behavior change.
- [ ] Document any temporary compatibility shim and its removal condition.
- [ ] Commit each validated slice separately with its checks recorded.

## Completion criteria

- [ ] Every original `src` file is accounted for as moved, split, intentionally
      retained, or verified obsolete.
- [ ] All 11 features have clear ownership and no empty scaffolding.
- [ ] Shared modules contain no client, billing, contract, or other business
      policies.
- [ ] The application builds, required tests pass, and deployment packaging
      contains all required runtime assets without operational data or generated
      clutter.
- [ ] Documentation and supported operational commands match the final
      structure.
