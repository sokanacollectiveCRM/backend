Below is the **production task backlog** to get Sokana360 ready for the October
12 testing milestone. The focus is not “perfect architecture.” The focus is
**tenant-safe, billing-safe, testable production workflow**.

## Epic 1 — Production Baseline & Inventory

### Task 1.1 — Confirm deployed backend revision

**Owner:** Jerry  
**Goal:** Identify exactly which backend revision is serving production.  
**Acceptance criteria:**  
Backend service name, revision ID, environment variables, feature flags, and
deployment region are documented.

### Task 1.2 — Confirm deployed frontend app

**Owner:** Jerry  
**Goal:** Verify whether the CRM app or older frontend package is the active
app.  
**Acceptance criteria:**  
Live frontend repo/package, deployed URL, build command, and API base URL are
documented.

### Task 1.3 — Capture Cloud SQL schema baseline

**Owner:** Jerry  
**Goal:** Export current tables, columns, indexes, constraints, and row
counts.  
**Acceptance criteria:**  
Schema baseline saved before migrations begin.

### Task 1.4 — Identify remaining Supabase usage

**Owner:** Jerry  
**Goal:** Find every active Supabase read/write path.  
**Acceptance criteria:**  
List of Supabase-dependent files and whether each is active, legacy, or
removable.

### Task 1.5 — Build API route inventory

**Owner:** Jerry  
**Goal:** Document all mounted backend routes and frontend callers.  
**Acceptance criteria:**  
Every route has: method, path, controller, auth requirement, frontend caller,
and tenant-scope requirement.

### Task 1.6 — Identify all financial writers

**Owner:** Jerry  
**Goal:** Find every writer to contracts, payments, invoices, hours,
assignments, and payment methods.  
**Acceptance criteria:**  
No billing or care-operation writer is unknown before refactor begins.

### Task 1.7 — Confirm active signing/payment provider

**Owner:** Jerry + Sonia  
**Goal:** Confirm QuickBooks, Stripe, and native signing/payment as the current
production path. SignNow and DocuSign are removed.  
**Acceptance criteria:**  
One verified signing path and one verified payment path are selected for
October 12.

This matches the plan’s Phase 1 exit gate: deployed system, schema baseline,
source of truth per entity, payment path, and compatibility fixtures.

---

# Epic 2 — Business Rules & Production Decisions

### Task 2.1 — Define deposit rule

**Owner:** Sonia + Jerry  
**Decision needed:**  
Does the deposit reduce later invoices, represent prepaid hours, or remain a
separate fee?

### Task 2.2 — Define family billing rates

**Owner:** Sonia  
**Goal:** Decide the rates families are charged for postpartum work.  
**Acceptance criteria:**  
Rates are documented by service type and effective date.

### Task 2.3 — Define provider compensation rates

**Owner:** Sonia  
**Goal:** Decide what doulas/providers are paid.  
**Acceptance criteria:**  
Provider pay rules are documented by service type, client/program, and exception
policy.

### Task 2.4 — Define biweekly billing period

**Owner:** Sonia + Jerry  
**Goal:** Set anchor date, timezone, cutoff day/time, invoice due date, and
grace period.  
**Acceptance criteria:**  
Billing period logic can be encoded as tenant settings.

### Task 2.5 — Define late submission policy

**Owner:** Sonia  
**Goal:** Decide how late hours are handled.  
**Acceptance criteria:**  
Late hours have a clear status: allowed, rejected, held for next cycle, or admin
override.

### Task 2.6 — Define correction policy

**Owner:** Sonia + Jerry  
**Goal:** Decide how approved hours can be corrected.  
**Acceptance criteria:**  
Correction flow preserves old approved record and creates a new revision.

### Task 2.7 — Define payout eligibility

**Owner:** Sonia  
**Decision needed:**  
Is provider payout based on approved work or collected family payment?

These decisions are explicitly called out as first-two-day decisions because
they directly affect implementation.

---

# Epic 3 — Modular Monolith Foundation

### Task 3.1 — Create module folder structure

**Owner:** Jerry  
**Goal:** Add module shells without changing behavior.  
**Modules:**  
Tenancy, Identity, Access Control, Clients, Providers, Care Operations, Billing,
Documents, Reporting, Integrations, Audit.

### Task 3.2 — Create shared request context type

**Owner:** Jerry  
**Goal:** Add server-side request context with tenant, user, membership, role,
permissions, and platform admin flag.  
**Acceptance criteria:**  
Services and repositories can receive explicit context instead of reading
scattered request fields.

### Task 3.3 — Create shared transaction interface

**Owner:** Jerry  
**Goal:** Centralize transaction handling for billing, approval, audit, and
payout flows.  
**Acceptance criteria:**  
Critical writes can run in a single database transaction.

### Task 3.4 — Create module public interfaces

**Owner:** Jerry  
**Goal:** Prevent cross-module repository imports.  
**Acceptance criteria:**  
Modules expose stable service/use-case interfaces through `index.ts`.

### Task 3.5 — Preserve current route behavior

**Owner:** Jerry  
**Goal:** Keep existing URLs, aliases, auth transports, response envelopes, and
feature gates.  
**Acceptance criteria:**  
No frontend-breaking API changes during shell creation.

The plan is clear that moving files alone is not enough; route order, aliases,
middleware, request fields, response envelopes, and feature gates must be
preserved.

---

# Epic 4 — Tenancy Foundation

### Task 4.1 — Create `tenants` table

**Owner:** Jerry  
**Goal:** Add tenant records with UUID, slug, name, and lifecycle status.

### Task 4.2 — Create `tenant_settings` table

**Owner:** Jerry  
**Goal:** Store timezone, currency, billing anchor, cutoff, due date, and rule
version.

### Task 4.3 — Create `memberships` table

**Owner:** Jerry  
**Goal:** Link users to tenants.  
**Acceptance criteria:**  
One user can belong to one or more organizations.

### Task 4.4 — Create tenant-scoped roles and permissions

**Owner:** Jerry  
**Goal:** Replace global role assumptions with membership-based permissions.  
**Acceptance criteria:**  
Admin, billing, doula, and client permissions resolve through membership.

### Task 4.5 — Seed Sokana Collective tenant

**Owner:** Jerry  
**Goal:** Create the first tenant.  
**Acceptance criteria:**  
Sokana Collective has deterministic tenant ID/slug in staging and production.

### Task 4.6 — Map existing users to memberships

**Owner:** Jerry + Sonia  
**Goal:** Assign current users to Sokana Collective.  
**Acceptance criteria:**  
No ambiguous user is silently assigned.

### Task 4.7 — Add nullable `tenant_id` columns

**Owner:** Jerry  
**Tables:**  
Clients, doulas, assignments, hours, contracts, invoices, payments, payment
schedules, payment methods, documents, audit-related records.

### Task 4.8 — Backfill tenant ownership

**Owner:** Jerry  
**Goal:** Assign verified existing records to Sokana Collective.  
**Acceptance criteria:**  
Orphans/test rows are quarantined instead of guessed.

### Task 4.9 — Enforce tenant filters in repositories

**Owner:** Jerry  
**Goal:** Every list, read, update, delete, export, and download checks tenant
context.  
**Acceptance criteria:**  
Queries do not use only global IDs for tenant-owned records.

### Task 4.10 — Add tenant constraints

**Owner:** Jerry  
**Goal:** Add `NOT NULL`, foreign keys, and composite uniqueness after
validation.  
**Acceptance criteria:**  
Cross-tenant references are structurally prevented.

### Task 4.11 — Create second synthetic tenant

**Owner:** Jerry  
**Goal:** Test tenant isolation before production testing.  
**Acceptance criteria:**  
Tenant B cannot access Tenant A records through any exposed route.

Tenant isolation is the largest missing production foundation, and the plan
explicitly says tenant scoping cannot be deferred on exposed legacy routes.

---

# Epic 5 — Access Control

### Task 5.1 — Replace global admin assumptions

**Owner:** Jerry  
**Goal:** Existing Sokana admins should not automatically become platform
admins.  
**Acceptance criteria:**  
`platform_admin` defaults to false.

### Task 5.2 — Implement membership permission resolver

**Owner:** Jerry  
**Goal:** Resolve user permissions server-side from active tenant membership.

### Task 5.3 — Preserve ownership checks

**Owner:** Jerry  
**Goal:** Tenant checks do not replace client/provider ownership checks.  
**Acceptance criteria:**  
Clients can only see their own billing; doulas only see assigned clients and
their own hours.

### Task 5.4 — Update `authorizeRoles` compatibility wrapper

**Owner:** Jerry  
**Goal:** Existing role middleware keeps working while using membership
permissions underneath.

### Task 5.5 — Add inactive membership denial

**Owner:** Jerry  
**Goal:** Inactive users cannot access tenant data.

### Task 5.6 — Add permission audit events

**Owner:** Jerry  
**Goal:** Log denied sensitive access attempts without leaking PHI.

The current gap is that roles and account access are not modeled as organization
memberships; existing ownership checks must remain in addition to tenant checks.

---

# Epic 6 — Care Operations / Hours Workflow

### Task 6.1 — Move hours ownership out of `SupabaseUserRepository`

**Owner:** Jerry  
**Goal:** Hours belong to Care Operations, not user identity.  
**Acceptance criteria:**  
All hours writes go through Care Operations repository/service.

### Task 6.2 — Create `service_time_entries` model or extend `hours`

**Owner:** Jerry  
**Goal:** Represent draft, submitted, approved, rejected, corrected states.  
**Acceptance criteria:**  
Do not create two independently writable hours tables.

### Task 6.3 — Add time-entry validation

**Owner:** Jerry  
**Rules:**  
Valid interval, no overlap, correct assignment, correct tenant, service type
allowed, not automatically billable if historical.

### Task 6.4 — Add submission endpoint

**Owner:** Jerry  
**Goal:** Doula/provider submits postpartum hours for approval.  
**Acceptance criteria:**  
Submitted entry is linked to tenant, client, provider, assignment, agreement,
and version.

### Task 6.5 — Add admin approval queue

**Owner:** Jerry  
**Goal:** Admin can view submitted hours pending review.

### Task 6.6 — Add approve/reject endpoint

**Owner:** Jerry  
**Goal:** Admin can approve or reject submitted hours.  
**Acceptance criteria:**  
Approval uses optimistic version checks and writes audit event in same
transaction.

### Task 6.7 — Add correction flow

**Owner:** Jerry  
**Goal:** Approved work cannot be silently edited.  
**Acceptance criteria:**  
Corrections create new revisions and preserve source history.

### Task 6.8 — Exclude historical hours from new billing

**Owner:** Jerry + Sonia  
**Goal:** Existing hours should not become newly billable automatically.  
**Acceptance criteria:**  
Historical hours are marked excluded until reviewed.

The plan specifically distinguishes document approval from care-hours approval;
doula document approval does not satisfy the hours approval requirement.

---

# Epic 7 — Agreement Completion

### Task 7.1 — Normalize signed-agreement event

**Owner:** Jerry  
**Goal:** Native and legacy signing should produce one normalized event.

### Task 7.2 — Add idempotency for agreement completion

**Owner:** Jerry  
**Goal:** Duplicate signing events do not create duplicate billing effects.

### Task 7.3 — Snapshot billing terms on agreement

**Owner:** Jerry  
**Goal:** Agreement stores billing rules, rates, deposit policy, and rule
version active at signing.

### Task 7.4 — Link agreement to client and tenant

**Owner:** Jerry  
**Goal:** Billing and care operations can verify work belongs to a valid signed
agreement.

### Task 7.5 — Preserve signed artifacts

**Owner:** Jerry  
**Goal:** Existing contract records and PDFs remain accessible.

The October 12 requirement is one normalized, idempotent agreement-completed
event.

---

# Epic 8 — Deposit & Payment Path

### Task 8.1 — Verify payment provider path

**Owner:** Jerry  
**Goal:** Decide and confirm whether QuickBooks or Stripe is the live October 12
path.

### Task 8.2 — Create deposit obligation

**Owner:** Jerry  
**Goal:** After agreement completion, create exactly one deposit
obligation/payment link.

### Task 8.3 — Add duplicate payment protection

**Owner:** Jerry  
**Goal:** Duplicate checkout events or webhooks cannot mark multiple deposits.

### Task 8.4 — Add payment status reconciliation

**Owner:** Jerry  
**Goal:** External payment state and local payment state can be reconciled.

### Task 8.5 — Add failed/expired card state

**Owner:** Jerry  
**Goal:** Missing or expired cards produce recoverable states, not silent
failure.

### Task 8.6 — Add card update recovery

**Owner:** Jerry  
**Goal:** Family can update card and retry the same invoice/balance.  
**Acceptance criteria:**  
No second invoice is created during retry.

The plan requires one verified payment path and reliable payment-status
reconciliation.

---

# Epic 9 — Biweekly Invoice Workflow

### Task 9.1 — Build invoice preview

**Owner:** Jerry  
**Goal:** Preview approved, uninvoiced postpartum work for a billing period.

### Task 9.2 — Implement invoice finalization

**Owner:** Jerry  
**Goal:** Convert preview into finalized invoice with locked line items.

### Task 9.3 — Snapshot invoice line item data

**Owner:** Jerry  
**Goal:** Store minutes, rate, amount, source entry revision, agreement, and
rule version.

### Task 9.4 — Prevent duplicate invoice allocation

**Owner:** Jerry  
**Goal:** Same approved time-entry revision cannot be billed twice.

### Task 9.5 — Add biweekly boundary rules

**Owner:** Jerry  
**Goal:** Anchor date, timezone, cutoff, and due date come from tenant settings.

### Task 9.6 — Add invoice payment state

**Owner:** Jerry  
**Goal:** Track draft, finalized, sent, paid, failed, retry-needed, voided, or
corrected.

### Task 9.7 — Add invoice audit events

**Owner:** Jerry  
**Goal:** Preview, finalization, payment, failure, and correction events are
traceable.

Billing must consume approved Care Operations records, and Care Operations
should not import Billing.

---

# Epic 10 — Provider Payout Records

### Task 10.1 — Create provider payout table

**Owner:** Jerry  
**Goal:** Store payable records without automatic bank transfer.

### Task 10.2 — Create payout source links

**Owner:** Jerry  
**Goal:** Link payout record to approved work and invoice line items.

### Task 10.3 — Snapshot provider pay rate

**Owner:** Jerry  
**Goal:** Payout amount remains stable even if rates change later.

### Task 10.4 — Prevent duplicate payouts

**Owner:** Jerry  
**Goal:** Same source work cannot create multiple payout records.

### Task 10.5 — Add manual disbursement status

**Owner:** Jerry  
**Statuses:**  
Pending, payable, held, paid manually, cancelled, corrected.

### Task 10.6 — Add payout audit trail

**Owner:** Jerry  
**Goal:** Every payout creation/status change is visible.

Provider payout records are explicitly missing and required for October 12.

---

# Epic 11 — Durable Jobs & Safe Reruns

### Task 11.1 — Create billing job run table

**Owner:** Jerry  
**Goal:** Track scheduled invoice generation and retries.

### Task 11.2 — Add durable job claims/leases

**Owner:** Jerry  
**Goal:** Prevent two workers from processing the same invoice period.

### Task 11.3 — Add stable idempotency keys

**Owner:** Jerry  
**Goal:** Jobs can safely rerun after crash or timeout.

### Task 11.4 — Add bounded retry policy

**Owner:** Jerry  
**Goal:** Failed jobs retry safely without infinite loops.

### Task 11.5 — Add job visibility

**Owner:** Jerry  
**Goal:** Admin/developer can see job status, attempts, and errors.

### Task 11.6 — Pause jobs during rollback/migration

**Owner:** Jerry  
**Goal:** Prevent billing side effects during deployment issues.

The risk matrix flags duplicate invoices/payouts, uncertain external effects,
and overlapping background processing as major production risks.

---

# Epic 12 — Audit Logging

### Task 12.1 — Create common audit API

**Owner:** Jerry  
**Goal:** Modules write durable audit events consistently.

### Task 12.2 — Write approval audit events

**Owner:** Jerry  
**Events:**  
Submitted, approved, rejected, corrected.

### Task 12.3 — Write billing audit events

**Owner:** Jerry  
**Events:**  
Invoice previewed, finalized, sent, paid, failed, retried.

### Task 12.4 — Write payout audit events

**Owner:** Jerry  
**Events:**  
Payout created, held, marked paid, corrected.

### Task 12.5 — Write permission audit events

**Owner:** Jerry  
**Events:**  
Denied access, cross-tenant attempt, export/download attempt.

### Task 12.6 — Prevent sensitive payload leakage

**Owner:** Jerry  
**Goal:** Audit metadata should be useful but not expose unnecessary PHI.

Important state changes should write audit records in the same transaction.

---

# Epic 13 — Frontend Tenant Alignment

### Task 13.1 — Add tenant context to frontend

**Owner:** Jerry  
**Goal:** Frontend receives selected tenant and server-derived permissions.

### Task 13.2 — Update API request layer

**Owner:** Jerry  
**Goal:** `api/http.ts` consistently attaches tenant context.

### Task 13.3 — Update cache keys

**Owner:** Jerry  
**Goal:** Caches use tenant + user/session identity, not only client ID.

### Task 13.4 — Update protected routes

**Owner:** Jerry  
**Goal:** UI access follows membership permissions.

### Task 13.5 — Preserve public signing behavior

**Owner:** Jerry  
**Goal:** Public signing sessions resolve tenant from verified
invitation/session, not arbitrary body value.

### Task 13.6 — Add tenant switch invalidation

**Owner:** Jerry  
**Goal:** Tenant switch clears caches, cancels stale requests, and rechecks
permissions.

The current frontend cache problem is specifically called out:
`clientDetailCache.ts` is keyed only by client ID.

---

# Epic 14 — Frontend Care/Billing Screens

### Task 14.1 — Extend doula hours UI

**Owner:** Jerry  
**Goal:** Add draft, submitted, approved, rejected, and correction states.

### Task 14.2 — Add admin approval queue UI

**Owner:** Jerry  
**Goal:** Admin can approve/reject submitted hours.

### Task 14.3 — Add review history UI

**Owner:** Jerry  
**Goal:** Admin and provider can see status history.

### Task 14.4 — Add invoice preview UI

**Owner:** Jerry  
**Goal:** Admin can preview approved-hours invoice before finalization.

### Task 14.5 — Add invoice finalization UI

**Owner:** Jerry  
**Goal:** Admin can finalize invoice.

### Task 14.6 — Update family billing portal

**Owner:** Jerry  
**Goal:** Family can view deposit, invoice, payment status, failed payment
state, and card recovery.

### Task 14.7 — Add payout records view

**Owner:** Jerry  
**Goal:** Admin can see provider payable records and manual disbursement status.

The frontend requirement is that admin, doula, and family complete the workflow
without manual database edits.

---

# Epic 15 — Testing

### Task 15.1 — Add route characterization tests

**Owner:** Jerry  
**Goal:** Existing routes keep same response shapes during refactor.

### Task 15.2 — Add tenant isolation tests

**Owner:** Jerry  
**Cases:**  
Tenant A cannot list, read, edit, delete, export, or download Tenant B records.

### Task 15.3 — Add membership tests

**Owner:** Jerry  
**Cases:**  
Inactive member denied; same user has different permissions in different
tenants.

### Task 15.4 — Add ownership tests

**Owner:** Jerry  
**Cases:**  
Client sees own billing only; doula sees assigned clients and own hours only.

### Task 15.5 — Add agreement idempotency tests

**Owner:** Jerry  
**Cases:**  
Native completion and legacy webhook produce one normalized effect.

### Task 15.6 — Add deposit/payment tests

**Owner:** Jerry  
**Cases:**  
Duplicate checkout safe; return page alone cannot mark paid.

### Task 15.7 — Add time-entry tests

**Owner:** Jerry  
**Cases:**  
Invalid interval, overlap, wrong assignment, wrong tenant, prenatal exclusion,
late submission.

### Task 15.8 — Add approval tests

**Owner:** Jerry  
**Cases:**  
Unauthorized reviewer, concurrent approval, stale version, rejection,
resubmission, correction.

### Task 15.9 — Add invoice tests

**Owner:** Jerry  
**Cases:**  
Biweekly boundaries, timezone, rounding, deposit treatment, approved entries
only.

### Task 15.10 — Add concurrency tests

**Owner:** Jerry  
**Cases:**  
Two workers produce one invoice, one allocation, one payout result.

### Task 15.11 — Add card recovery tests

**Owner:** Jerry  
**Cases:**  
Missing card, expired card, inactive card, replacement failure, replacement
success, retry same invoice.

### Task 15.12 — Add migration tests

**Owner:** Jerry  
**Cases:**  
No null tenants, no cross-tenant references, preserved totals, historical hours
not rebilled.

### Task 15.13 — Add browser E2E test

**Owner:** Jerry  
**Scenario:**  
Doula submission → admin approval → family invoice/payment → payout record →
card recovery.

The required testing matrix is already spelled out and needs real PostgreSQL
integration tests for transactions, constraints, concurrency, and tenant
isolation.

---

# Epic 16 — Migration & Rollback

### Task 16.1 — Use expand/backfill/enforce/retire migration strategy

**Owner:** Jerry  
**Goal:** Avoid destructive migration risk.

### Task 16.2 — Add additive schema first

**Owner:** Jerry  
**Goal:** New nullable columns and new tables before enforcement.

### Task 16.3 — Backfill parent records before child records

**Owner:** Jerry  
**Goal:** Tenant, users, memberships, clients, providers, agreements, care,
billing.

### Task 16.4 — Reconcile financial totals

**Owner:** Jerry + Sonia  
**Goal:** Ensure invoices, payments, schedules, and balances are preserved.

### Task 16.5 — Add constraints only after validation

**Owner:** Jerry  
**Goal:** No premature `NOT NULL` or FK enforcement before data is clean.

### Task 16.6 — Remove transitional defaults

**Owner:** Jerry  
**Goal:** No hidden Sokana-only default after tenant enforcement.

### Task 16.7 — Create rollback plan

**Owner:** Jerry  
**Goal:** Define what can be rolled back before and after financial issuance.

The migration principle in the plan is **expand → backfill → enforce → retire**.

---

# Epic 17 — Production Readiness

### Task 17.1 — Create seeded test accounts

**Owner:** Jerry + Sonia  
**Accounts:**  
Admin, billing user, doula/provider, family/client, second-tenant test user.

### Task 17.2 — Create October 12 test script

**Owner:** Jerry  
**Goal:** Step-by-step workflow demo/test script.

### Task 17.3 — Rehearse migration on production-shaped copy

**Owner:** Jerry  
**Goal:** Validate migration timing, errors, and rollback options.

### Task 17.4 — Freeze structural changes by October 6

**Owner:** Jerry  
**Goal:** After October 6, only blockers and bugs get fixed.

### Task 17.5 — Validate totals with stakeholders

**Owner:** Sonia + Jerry  
**Goal:** Confirm billing, payout, and payment records match expected business
rules.

### Task 17.6 — Prepare production monitoring checklist

**Owner:** Jerry  
**Must include:**  
Errors, payment failures, job failures, duplicate prevention, tenant access
failures, audit logs.

### Task 17.7 — Create go/no-go checklist

**Owner:** Jerry + Sonia  
**Goal:** Decide whether October 12 testing is safe.

Phase 7 is testing and verification from October 6–11, with October 12 as the
supported testing milestone.

---

# The real priority order

Do it in this order:

1. **Inventory production**
2. **Lock business rules**
3. **Create module shells**
4. **Implement tenancy**
5. **Extract hours workflow**
6. **Build approval**
7. **Normalize agreement completion**
8. **Build deposit/payment recovery**
9. **Build invoice finalization**
10. **Build payout records**
11. **Add audit**
12. **Align frontend**
13. **Run full testing**
14. **Freeze and fix only**

## What not to waste time on before October 12

Do **not** prioritize:

- Moving every file into the final folder structure
- Removing all legacy routes
- Full Supabase exit
- Full PHI broker consolidation
- Custom role builder
- Tenant self-service onboarding
- Insurance claims automation
- Automated payroll/provider transfers
- Full reporting redesign

Those are explicitly deferred items.

Bottom line: **ship the spine first.** Tenant isolation, approved hours, invoice
generation, card recovery, payout records, and audit trail. That is the
production muscle. The folder cleanup can wear a suit later.
