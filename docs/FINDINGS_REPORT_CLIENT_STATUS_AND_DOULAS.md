# Findings Report: Client Status, Payments, Doulas & Assignments

**Purpose:** Report only. No status or data has been changed. This document summarizes what we know and what still needs to be determined and confirmed.

**See also:** **[MISSING_DATA_REPORT.md](./MISSING_DATA_REPORT.md)** – consolidated list of missing data (payment–invoice link, doulas, assignments, status, edoula contracts) and remediation.

---

## 1. Client status and payments

### What we know

- **Client list and status** come from Cloud SQL table **`phi_clients`** (column **`status`**). All 401 clients currently have **`status = 'pending'`** in the database.
- **Payment evidence** comes from Cloud SQL table **`phi_invoices`** (columns **`client_id`**, **`status`**, **`paid_total_amount`**). A client is treated as “has payment” if they have at least one invoice with `status = 'PAID'` or `status = 'PARTIAL'` with `paid_total_amount > 0`.

### Findings

| Finding | Count | Meaning |
|--------|--------|--------|
| **Clients with at least one paid/partial invoice** | **27** | These 27 clients have payment activity. They are candidates to be **connected to client status** and confirmed as active or done with services. |
| **Clients with no paid invoice** | **374** | Status and service completion still need to be **determined and confirmed** (no payment evidence in `phi_invoices`). |

### What is *not* done (per your request)

- **No status has been set** from payment data. The 27 with payments are still `pending` in `phi_clients.status`.
- Next steps (when you decide): connect those 27 to status (e.g. active/complete) and confirm; for the rest, determine and confirm status through your process.

### Script for reproducibility

- **`scripts/client-status-from-payments.ts`** – Uses `phi_invoices` to compute “has payment” per client and reports current `phi_clients.status`. Run with Cloud SQL env (and proxy) set.

---

## 1b. Payment ↔ Invoice ↔ Customer

### Is there a schema connection that determines they are linked?

- **No foreign key** from `payments` to `phi_invoices`. The DB does **not** enforce that `payments.invoice_id` references `phi_invoices.id`.
- There **is** a foreign key **`payments.client_id` → `phi_clients.id`**, so when `client_id` is set it must be a valid client.
- The **only** link between a payment and an invoice is **by convention**: the column **`payments.invoice_id`** is intended to hold the value of **`phi_invoices.id`**. So “this payment is for this invoice” is determined only when your data (or app) sets `payment.invoice_id = invoice.id`; the database does not enforce or define that relationship.

### How they connect in data

- **Payments** (`payments`): **`client_id`** (→ `phi_clients.id`), **`invoice_id`** (intended = `phi_invoices.id`, no FK).
- **Invoices** (`phi_invoices`): **`client_id`** (→ `phi_clients.id`).

So: the **customer for a payment** is from **`payment.client_id`** when set; when **`payment.invoice_id`** is set (by your process), that payment is **treated as connected** to the invoice with that id, and that invoice’s **`invoice.client_id`** is the same customer.

- **API:** `GET /api/payments` returns `invoice_id`, `invoice`, `client_id`, and `client_name` so the UI can link payment → invoice and show the customer.

### Verify in your DB

- **`scripts/verify-payment-invoice-customer-link.ts`** – Checks for a FK from payments to phi_invoices; reports counts of payments with `client_id` / `invoice_id` and how many match a `phi_invoices` row. Run: `npx tsx scripts/verify-payment-invoice-customer-link.ts` (Cloud SQL env set).

---

## 2. Doulas: not in the tables you have

### What the backend expects

- **Doulas** are expected to come from **Supabase** table **`public.users`** (users with `role = 'doula'` or `'admin'`).
- The backend does **not** read doulas from Cloud SQL. There is **no users or doulas table** in the Cloud SQL tables you have.

### What we see

- **Supabase:** The backend calls “get doulas” from Supabase and gets: **“Could not find the table 'public.users' in the schema cache”**. So in your Supabase project, **`public.users` does not exist** (or is not visible). Therefore we **do not know who the doulas are** from current data.
- **Cloud SQL:** The tables you have in Cloud SQL are:  
  `phi_clients`, `phi_contracts`, `phi_events`, `phi_invoices`, `phi_notes`, `phi_time_track`, `phi_access_audit`, `payments`, `expenses`, `library_items`.  
  **None of these are a users or doulas table.** So doulas are **not** in the Cloud SQL tables you uploaded/have.

### What is needed (to “know who the doulas are”)

- **Option A:** Create and populate **Supabase `public.users`** (with role doula/admin) and keep it in sync with Supabase Auth when you invite doulas; **or**
- **Option B:** Add a **doulas/users table in Cloud SQL** and change the backend to read doulas from Cloud SQL instead of Supabase.

Until one of these is in place, we **cannot report a list of doulas** from the current system.

---

## 3. Assignments: who (doulas) are assigned to which clients

### What the backend expects

- **Assignments** (which doula is assigned to which client) are expected in an **`assignments`** table with at least **`doula_id`** and **`client_id`** (and typically `status`, e.g. `'active'`).
- The backend uses this for:
  - **Supabase:** `SupabaseAssignmentRepository` reads **Supabase `public.assignments`** and joins to **`public.users`** for doula names.
  - **Cloud SQL:** `CloudSqlClientRepository.getClientIdsAssignedToDoula()` runs:  
    `SELECT client_id FROM assignments WHERE doula_id = $1 AND status = 'active'`  
    So it expects an **`assignments`** table in **Cloud SQL** as well.

### What we see

- **Cloud SQL:** When listing tables in your Cloud SQL database, there was **no `assignments`** table among the 10 tables. So we **do not have assignment data** in Cloud SQL.
- **Supabase:** Because `public.users` (and likely `public.assignments`) are missing or not in use, we **do not have assignment data** in Supabase either.

### What is needed (to “see who is assigned to whom on the client list”)

- **If using Cloud SQL for clients:** Add an **`assignments`** table in Cloud SQL (e.g. `doula_id`, `client_id`, `status`, `assigned_at`) and populate it. Then the backend can report “assigned doulas” per client (once it reads assignments from Cloud SQL consistently).
- **If using Supabase for team/assignments:** Create **`public.assignments`** (and **`public.users`**) in Supabase and populate them; then the existing Supabase-based assignment/doula code can report who is assigned to whom.

Until assignments (and doulas) exist in one of these places, we **cannot report** “who the doulas are and who they are assigned to on the client list.”

---

## 4. Edoula contracts: migration and storage

- **There are contracts on edoula that need to be migrated and stored.** When you get a chance, those contracts should be downloaded and stored in your own system (e.g. Cloud SQL **`phi_contracts`** or your chosen storage) so you own the records and are not dependent on edoula long-term.
- **You only have the URLs** for those contracts; the URLs are **secure behind edoula** (access-controlled). For migration, you will need to either:
  - Download the contract files (when possible) and store them in your backend/storage and link them in `phi_contracts`, or
  - Record the fact that the contract exists and where it lives (edoula) until download is possible.
- Do **not** put the actual edoula contract URLs in the repo or in committed docs (see §5 below). Keep them in `.env`, a secure config, or a backend-only store.

---

## 5. URLs and security in Cursor / repo

- **`.env` is in `.gitignore`.** So any URLs or secrets you put in `.env` (e.g. `EDOULA_CONTRACT_BASE_URL`, or a list of URLs in an env var) are **not** committed to git and are not in the repo. That keeps them out of version control and out of Cursor's committed workspace.
- **In Cursor:** The AI and tools can read files in your workspace. If you paste **sensitive URLs** (e.g. edoula contract links) into:
  - **Code or committed docs** → they can end up in git and be exposed. **Avoid.**
  - **Uncommitted files or `.env`** → they are not in the repo; `.env` is gitignored, so they stay local. **Prefer.**
- **Recommendation:** Treat edoula contract URLs as sensitive. Store them in `.env` or a server-side config/database, not in source code or in this findings doc. When you implement a migration script, have it read URLs from env or from a secure backend store so the URLs remain secure in Cursor and in the repo.

---

## 6. Summary table

| Item | Status | Where it lives / what’s missing |
|------|--------|----------------------------------|
| **Client list & status** | Known | Cloud SQL **`phi_clients`** (`status` column). All 401 currently `pending`. |
| **Payment evidence** | Known | Cloud SQL **`phi_invoices`**. **27 clients** have paid/partial invoices; **374** do not. |
| **Connect payments → status** | Not done (report only) | 27 to be connected to status and confirmed; rest to be determined and confirmed. |
| **Who the doulas are** | Unknown | Not in your tables. Backend expects Supabase **`public.users`** (missing). No doulas table in Cloud SQL. |
| **Who is assigned to whom** | Unknown | Backend expects **`assignments`** (Supabase or Cloud SQL). Table not present in your Cloud SQL; Supabase side not in use. |
| **Edoula contracts** | To migrate | Contracts on edoula need to be downloaded and stored (e.g. in `phi_contracts`). You have URLs only; they are secure behind edoula. Keep URLs out of the repo (use `.env` or secure store). |

---

## 7. Recommended next steps (no changes made yet)

1. **Status and payments:** Keep reporting only until you confirm. When ready: (a) confirm the 27 with paid invoices as active/complete and update `phi_clients.status`; (b) define process for the remaining 374.
2. **Doulas:** Decide where doulas will live (Supabase `public.users` or a Cloud SQL table). Create the table and populate it so “who the doulas are” can be reported.
3. **Assignments:** Add and populate **`assignments`** (in Cloud SQL and/or Supabase) so “who is assigned to whom on the client list” can be reported.

4. **Edoula contracts:** When you get a chance, download contracts from edoula (you have the URLs, secure behind edoula) and store them in your system (e.g. `phi_contracts`). Do not put the actual URLs in the repo; use `.env` or a secure backend store.

This document is the findings report only; no status has been set and no new tables have been created by this process.
