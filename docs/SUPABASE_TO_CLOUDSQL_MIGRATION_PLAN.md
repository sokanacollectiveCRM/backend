# Migration plan: Supabase DB → Cloud SQL only (auth stays in Supabase)

**Objective:** Use **only Google Cloud SQL** for data storage. **Supabase** is used **only for auth** (login, session, tokens). All Supabase database table reads/writes and storage usage must be removed or migrated.

---

## Data storage decisions (target architecture)

| Area | Where data lives |
|------|------------------|
| **Stripe** | **Google Cloud SQL** – Stripe charges and payment records update the **`payments`** table in Cloud SQL. Customer/payment-method metadata will live in Cloud SQL (e.g. `phi_clients.stripe_customer_id`, `payment_methods` table). |
| **Contracts** | **Contract files** (PDFs, signed docs) → **private bucket in Google Cloud Storage (GCS)**. **Contract metadata/tables** (contract records, templates metadata, payment schedules, etc.) → **Google Cloud SQL**. |

---

## Phase 0: Already on Cloud SQL

- **Clients:** List/detail via `phi_clients` (cloudSqlClientRepository).
- **Payments:** List via Cloud SQL `payments`; Stripe charge insert writes to Cloud SQL `payments`.
- **Invoices:** List via Cloud SQL `phi_invoices`.
- **Reconciliation:** Reads from Cloud SQL invoices + payments.

**Remaining:** Many features still read/write Supabase tables (see `SUPABASE_DATABASE_USAGE_INVENTORY.md`).

---

## Phase 1: Stripe / billing (stop Supabase for charges and customer data)

**Goal:** Charge flow and customer/payment-method data live in Cloud SQL only.

1. **Stop writing to Supabase `charges`**  
   - Stripe charge handler already writes to Cloud SQL `payments`.  
   - Remove or gate the Supabase `charges` insert in `stripePaymentService.ts` so charges are only persisted in Cloud SQL.

2. **Migrate Stripe customer and payment-method data to Cloud SQL**  
   - Add to Cloud SQL (if not present):  
     - `stripe_customer_id` (and optionally `qbo_customer_id`) on `phi_clients` or a small `customers` table.  
     - `payment_methods` table: `id`, `client_id`, `stripe_payment_method_id`, `is_default`, etc.  
   - Implement Cloud SQL repos:  
     - Get/create Stripe customer by client id.  
     - Get/set default payment method by client id.  
   - Update `stripePaymentService.ts` (and any `stripePaymentService.ts` that reads customers/payment_methods) to use Cloud SQL only for customer and payment-method storage.  
   - Remove Supabase reads/writes for `customers` and `payment_methods`.

3. **QuickBooks / sync**  
   - If sync reads from Supabase `charges`, switch to reading from Cloud SQL `payments` (or remove sync until Cloud SQL is source of truth).

**Outcome:** Billing/charge flow uses Cloud SQL only; no Supabase DB for Stripe data.

---

## Phase 2: Clients and assignments

**Goal:** All client and assignment data from Cloud SQL only.

1. **Clients**  
   - Ensure every operational field used by portal, admin, contracts, and requests is in Cloud SQL `phi_clients` (or extended tables).  
   - Switch all remaining `client_info` reads/writes (portalController, portalInviteService, requestFormRepository, contractClientService, signNowContractProcessor, clientController, doulaController, dashboardRoutes, sensitiveAccess) to Cloud SQL client repository.  
   - Remove Supabase `client_info` usage.

2. **Assignments**  
   - Ensure Cloud SQL schema has `assignments` table (e.g. step3). Populate from Supabase if needed (one-time migration).  
   - Implement or extend Cloud SQL assignment repository (list/by client/by doula/CRUD).  
   - Switch supabaseAssignmentRepository and all callers (adminController, doulaController, sensitiveAccess, supabaseClientRepository) to Cloud SQL.  
   - Remove Supabase `assignments` usage.

**Outcome:** No Supabase for clients or assignments.

---

## Phase 3: Activities and users

**Goal:** Activities and user metadata from Cloud SQL only (auth still Supabase).

1. **Activities**  
   - Add or use `activities` (or `client_activities`) in Cloud SQL.  
   - Implement Cloud SQL activity repository.  
   - Switch supabaseActivityRepository and clientController to Cloud SQL.  
   - Remove Supabase `client_activities` usage.

2. **Users**  
   - Decide: either (a) Cloud SQL `users` table synced from auth metadata, or (b) no user rows (use auth only).  
   - If (a): add Cloud SQL `users` table, sync from Supabase Auth (or create on first login), switch supabaseUserRepository and contractClientService to Cloud SQL.  
   - Remove Supabase `users` table reads for app data.  
   - Notes and profile-pictures: move to Cloud SQL + URL or GCS.

**Outcome:** No Supabase for activities or user rows.

---

## Phase 4: Contracts and payment schedules

**Goal:** Contracts, contract payments, schedules, and installments in Cloud SQL only.

1. **Contracts**  
   - Add or use in Cloud SQL: `phi_contracts` (or `contracts`), `contract_templates`, `contract_signnow_integration`, `contract_payments`, `payment_schedules`, `payment_installments`, and any views used for dashboard/overdue/upcoming.  
   - Implement Cloud SQL repos for contracts, contract_payments, payment_schedules, payment_installments.  
   - Replace Supabase RPCs (`create_payment_schedule`, `get_overdue_payments`, `get_upcoming_payments`, `get_contract_payment_summary`, `update_overdue_flags`, `daily_payment_maintenance`) with Cloud SQL queries or stored procedures.  
   - Switch contractService, contractClientService, stripePaymentService, portalEligibilityService, simplePaymentService, paymentScheduleService, signNowContractProcessor, stripePaymentRoutes to Cloud SQL.  
   - Remove Supabase tables and RPCs for contracts and payment schedules.

2. **Storage**  
   - Migrate contract templates and signed contract files to a **private Google Cloud Storage (GCS) bucket**.  
   - Update contractProcessor, pdfTemplateFiller, signNowPdfService, supabaseContractService to use the private GCS bucket (and Cloud SQL for metadata/URLs).  
   - Remove Supabase storage usage for contracts.

**Outcome:** No Supabase for contracts or payment schedules; contract files in private GCS bucket, metadata in Cloud SQL.

---

## Phase 5: Invoices, QuickBooks, requests, doula docs

**Goal:** Invoices, QB tokens, requests, and doula documents in Cloud SQL (and GCS for files).

1. **Invoices**  
   - Already listing from Cloud SQL `phi_invoices`.  
   - Ensure all invoice creation (e.g. from QuickBooks) writes to Cloud SQL `phi_invoices` only; remove `persistInvoiceToSupabase`.

2. **QuickBooks**  
   - Move `quickbooks_tokens` to Cloud SQL (or env/secrets).  
   - Move QB customer id storage to Cloud SQL (e.g. `phi_clients` or `customers`).  
   - Update quickbooksController, createInvoice, ensureCustomerInQuickBooks, tokenUtils to use Cloud SQL.  
   - Remove Supabase `invoices` and `customers` (QB) and `quickbooks_tokens` usage.

3. **Requests**  
   - Add `requests` table in Cloud SQL.  
   - Implement Cloud SQL request repository.  
   - Switch requestFormRepository to Cloud SQL.  
   - Remove Supabase `requests` usage.

4. **Doula documents**  
   - Add doula documents table in Cloud SQL (metadata); store files in GCS.  
   - Implement Cloud SQL doula document repo and update doulaDocumentUploadService to use GCS.  
   - Remove Supabase `doula_documents` and storage for doula docs.

**Outcome:** No Supabase for invoices, QB, requests, or doula docs.

---

## Phase 6: Cleanup

1. **Code**  
   - Remove or stub every Supabase client usage that was for database or storage (keep only `supabase.auth`).  
   - Remove Supabase DB init from app bootstrap where it’s only used for data (keep auth client).  
   - Delete or archive Supabase-specific repos (e.g. supabaseUserRepository, supabaseClientRepository, supabaseAssignmentRepository, supabaseActivityRepository, etc.) once their Cloud SQL equivalents are the only path.

2. **Config / env**  
   - Document that Supabase URL/key are for **auth only**.  
   - Remove any Supabase DB connection strings or config used only for data.

3. **Tests**  
   - Update tests to use Cloud SQL (and mocks for auth).  
   - Remove tests that assert Supabase DB or storage behavior.

---

## What stays in Supabase

- **Auth only:**  
  - `supabase.auth.getUser(token)`  
  - `supabase.auth.signInWithPassword`, `signOut`, and any other auth methods used by the app  
  - No Supabase database tables or storage for application data

---

## Reference

- Full list of Supabase tables, RPCs, storage, and affected files: **`SUPABASE_DATABASE_USAGE_INVENTORY.md`**
