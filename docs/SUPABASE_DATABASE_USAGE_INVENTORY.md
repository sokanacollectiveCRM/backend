# Supabase database usage inventory

**Goal:** Use **only Google Cloud SQL** for data storage. **Supabase** should be used **only for auth** (login, session, `supabase.auth.getUser`). All table reads/writes and storage that currently use Supabase must be migrated to Cloud SQL (and optionally object storage elsewhere) or removed.

---

## Data storage decisions (target architecture)

| Area | Where data lives |
|------|------------------|
| **Stripe** | **Google Cloud SQL** – Stripe charges and payment records update the **`payments`** table in Cloud SQL. Customer/payment-method metadata will live in Cloud SQL (e.g. `phi_clients.stripe_customer_id`, `payment_methods` table). |
| **Contracts** | **Contract files** (PDFs, signed docs) → **private bucket in Google Cloud Storage (GCS)**. **Contract metadata/tables** (contract records, templates metadata, payment schedules, etc.) → **Google Cloud SQL**. |

---

## 1. Keep (Supabase auth only)

These use **Supabase Auth** (not database tables). **Do not remove.**

| File | Usage |
|------|--------|
| `src/controllers/authController.ts` | `supabase.auth.getUser(token)` – validate session |
| `src/middleware/authMiddleware.ts` | `supabase.auth.getUser(token)` – attach user to request |
| `src/services/supabaseAuthService.ts` | `supabase.auth.signInWithPassword`, `signOut`, etc. – login/logout |
| `src/controllers/doulaController.ts` | `supabase.auth.getUser(accessToken)` – doula auth |

---

## 2. Supabase database tables in use (to remove / migrate)

Every **Supabase table** (and RPC) that the backend reads or writes is listed below. Each should be migrated to Cloud SQL (or removed) so Supabase DB is no longer used.

### 2.1 Stripe / Billing (`src/services/payments/stripePaymentService.ts`, `src/services/stripePaymentService.ts`)

| Supabase table | Purpose | Migration target |
|----------------|---------|------------------|
| **customers** | Store `stripe_customer_id`; lookup by app customer id | Cloud SQL: add `stripe_customer_id` to `phi_clients` or new `customers` table in Cloud SQL |
| **payment_methods** | Store Stripe payment method id, default flag | Cloud SQL: new `payment_methods` table (or equivalent) |
| **charges** | Persist each Stripe charge | **Stripe updates Cloud SQL `payments` table only**; stop writing to Supabase `charges` |

### 2.2 Clients / portal

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **client_info** | supabaseClientRepository, portalController, portalInviteService, requestFormRepository, contractClientService, signNowContractProcessor, clientController (operational writes), doulaController, dashboardRoutes, sensitiveAccess | **Cloud SQL `phi_clients`** (already primary for list/detail; operational fields must be in Cloud SQL and broker/writes updated) |

### 2.3 Users / doulas

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **users** | supabaseUserRepository, contractClientService | Cloud SQL: new **users** table (or use auth metadata only and drop user rows) |

### 2.4 Assignments

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **assignments** | supabaseAssignmentRepository, supabaseClientRepository, sensitiveAccess, adminController, doulaController | **Cloud SQL `assignments`** (step3 schema has it; populate and switch reads/writes to Cloud SQL) |

### 2.5 Activities / notes

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **client_activities** | supabaseActivityRepository, clientController | **Cloud SQL `activities`** (step3 schema) |
| **notes** | supabaseUserRepository | Cloud SQL: **phi_notes** or new notes table |

### 2.6 Contracts

**Target:** Contract **metadata/tables** in **Google Cloud SQL**; contract **files** (PDFs, signed docs) in a **private Google Cloud Storage (GCS) bucket**.

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **contracts** | stripePaymentRoutes, portalEligibilityService, contractService, contractClientService, signNowContractProcessor, stripePaymentService | **Cloud SQL `phi_contracts`** (metadata); signed PDFs → **private GCS bucket** |
| **contract_templates** | supabaseContractService, contractClientService | Template metadata in **Cloud SQL**; template PDF files in **private GCS bucket** |
| **contract_payments** | portalEligibilityService, simplePaymentService, contractService, contractClientService, paymentScheduleService, signNowContractProcessor, stripePaymentService | **Cloud SQL** (contract_payments or phi_* equivalent) |
| **contract_signnow_integration** | contractClientService | **Cloud SQL** |
| **payment_schedules** | simplePaymentService, paymentScheduleService, signNowContractProcessor | **Cloud SQL** |
| **payment_installments** | stripePaymentService, signNowContractProcessor, simplePaymentService, paymentScheduleService | **Cloud SQL** |
| **payment_dashboard** (view?) | simplePaymentService, paymentScheduleService | **Cloud SQL** view or query |
| **payment_reminders** | paymentScheduleService | **Cloud SQL** |
| **payment_tracking** | dashboardRoutes | **Cloud SQL** |

### 2.7 Invoices / QuickBooks

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **invoices** | quickbooksController, persistInvoiceToSupabase | **Cloud SQL `phi_invoices`** (already used for GET /api/invoices; persist new invoices there) |
| **customers** (QuickBooks) | createInvoice, ensureCustomerInQuickBooks, saveQboCustomerId, getInvoiceableCustomers, upsertInternalCustomer | **Cloud SQL** (e.g. phi_clients + qbo_customer_id or customers table) |
| **quickbooks_tokens** | tokenUtils | **Cloud SQL** (new table or env-backed) |

### 2.8 Requests / forms

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **requests** | requestFormRepository | **Cloud SQL** (new `requests` table) |

### 2.9 Doula documents

| Supabase table / storage | Used in | Migration target |
|--------------------------|--------|------------------|
| **doula_documents** / **doula-documents** | doulaDocumentRepository | **Cloud SQL** table + object storage (e.g. GCS) for files |
| Storage bucket (doula docs) | doulaDocumentUploadService | Migrate to GCS or Cloud SQL + URL |

### 2.10 Profile / misc

| Supabase table | Used in | Migration target |
|----------------|--------|------------------|
| **profile-pictures** | supabaseUserRepository | **Cloud SQL** + storage URL or GCS |

### 2.11 Contracts – Storage (Supabase buckets → GCS)

| Current (Supabase) | Migration target |
|--------------------|------------------|
| **contract-templates** bucket | **Private GCS bucket** for contract template PDFs |
| **contracts** bucket | **Private GCS bucket** for signed contract PDFs |

### 2.12 RPCs (Supabase Postgres functions)

| RPC | Used in | Migration target |
|-----|--------|------------------|
| **create_payment_schedule** | simplePaymentService, paymentScheduleService | Implement in Cloud SQL or in-app logic |
| **get_overdue_payments** | simplePaymentService, paymentScheduleService | **Cloud SQL** query or view |
| **get_upcoming_payments** | paymentScheduleService | **Cloud SQL** query |
| **get_contract_payment_summary** | paymentScheduleService | **Cloud SQL** query |
| **update_overdue_flags** | simplePaymentService | **Cloud SQL** update or function |
| **daily_payment_maintenance** | simplePaymentService | **Cloud SQL** |
| **exec_sql** | setupStripeDb | Remove or replace with Cloud SQL migrations |

---

## 3. Supabase Storage (buckets)

These are **object storage**, not DB tables. Migrate to a **private Google Cloud Storage (GCS)** bucket and update code.

| Bucket | Used in | Migration target |
|--------|--------|------------------|
| **contract-templates** | contractProcessor, pdfTemplateFiller, supabaseContractService | **Private GCS bucket** (contract template PDFs) |
| **contracts** | contractProcessor, signNowPdfService | **Private GCS bucket** (signed contract PDFs) |

---

## 4. Files that import or use Supabase for data (not auth)

These files use Supabase **database** or **storage**. Each should be updated to use **Cloud SQL** (and optionally GCS) only, or the feature removed.

- `src/repositories/supabaseUserRepository.ts` – users, client_info, notes, profile-pictures
- `src/repositories/supabaseClientRepository.ts` – client_info, assignments
- `src/repositories/supabaseAssignmentRepository.ts` – assignments
- `src/repositories/supabaseActivityRepository.ts` – client_activities
- `src/repositories/requestFormRepository.ts` – client_info, requests
- `src/repositories/doulaDocumentRepository.ts` – doula_documents
- `src/services/payments/stripePaymentService.ts` – customers, payment_methods, charges (+ Cloud SQL payments already)
- `src/services/stripePaymentService.ts` – contracts, payment_installments, customers, charges
- `src/services/simplePaymentService.ts` – RPCs, payment_schedules, contract_payments, payment_dashboard
- `src/services/paymentScheduleService.ts` – RPCs, payment_schedules, contract_payments, payment_reminders
- `src/services/contractService.ts` – contracts, contract_payments
- `src/services/contractClientService.ts` – contracts, client_info, users, contract_templates, contract_signnow_integration, contract_payments
- `src/services/supabaseContractService.ts` – contract_templates, contracts (DB + storage)
- `src/services/portalEligibilityService.ts` – contracts, contract_payments
- `src/services/portalInviteService.ts` – client_info
- `src/services/invoice/persistInvoiceToSupabase.ts` – invoices
- `src/services/invoice/createInvoice.ts` – customers
- `src/services/customer/*.ts` – customers
- `src/services/payments/syncPaymentToQuickBooks.ts` – charges
- `src/services/payments/ensureCustomerInQuickBooks.ts` – customers
- `src/controllers/clientController.ts` – operational writes to client_info; activities (Supabase)
- `src/controllers/portalController.ts` – client_info
- `src/controllers/adminController.ts` – assignments
- `src/controllers/doulaController.ts` – assignments, users, activities, doula documents
- `src/controllers/quickbooksController.ts` – invoices
- `src/routes/stripePaymentRoutes.ts` – contracts
- `src/routes/dashboardRoutes.ts` – payment_tracking, client_info
- `src/utils/signNowContractProcessor.ts` – client_info, contracts, payment_schedules, payment_installments
- `src/utils/contractProcessor.ts` – storage contract-templates, contracts
- `src/utils/pdfTemplateFiller.ts` – storage contract-templates
- `src/utils/sensitiveAccess.ts` – assignments
- `src/utils/tokenUtils.ts` – quickbooks_tokens
- `src/services/signNowPdfService.ts` – storage contracts
- `src/db/setupStripeDb.ts` – RPC exec_sql
- `src/db/checkTables.ts` – payment_methods, charges

---

## 5. Recommended order to remove Supabase DB usage

1. **Stripe charge persistence** – Already writing to Cloud SQL `payments`. Next: stop writing to Supabase `charges` (or make it optional). Then migrate **customers** and **payment_methods** to Cloud SQL so the charge flow no longer reads from Supabase.
2. **Clients** – All reads/writes for list and detail should use **Cloud SQL `phi_clients`** only; remove any remaining **client_info** writes/reads from Supabase.
3. **Assignments** – Use **Cloud SQL `assignments`** only; switch assignmentRepository and all callers to Cloud SQL.
4. **Activities** – Use **Cloud SQL `activities`** only; switch activityRepository to Cloud SQL.
5. **Contracts** – Migrate contracts, contract_templates, contract_payments, and related tables to Cloud SQL; update contractService, contractClientService, stripePaymentService, portalEligibilityService.
6. **Payments (schedules, installments, dashboard)** – Migrate payment_schedules, contract_payments, payment_installments, and RPCs to Cloud SQL; update simplePaymentService and paymentScheduleService.
7. **Invoices / QuickBooks** – Persist invoices and customer data in Cloud SQL; update quickbooksController and invoice/customer services.
8. **Users/doulas** – Either use Cloud SQL **users** table or auth-only metadata; remove Supabase **users** reads.
9. **Requests, doula documents, profile-pictures, quickbooks_tokens** – Migrate each to Cloud SQL (and storage to GCS where needed).
10. **Storage** – Migrate contract-templates and contracts buckets to GCS; update contractProcessor, pdfTemplateFiller, signNowPdfService, supabaseContractService.

---

## 6. Summary

- **Keep:** Supabase **auth** only (`supabase.auth.*`).
- **Remove / migrate:** All Supabase **database** table access and **storage** bucket access to **Google Cloud SQL** (and GCS for files).
- **Already on Cloud SQL:** Client list/detail (phi_clients), payments list and charge insert (payments), invoices list (phi_invoices), reconciliation. The rest of the app still has many Supabase DB (and storage) dependencies; removing them is a phased migration as in §5.
