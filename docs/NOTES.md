# Notes

**Purpose:** Operational and setup notes (admins, passwords) plus a ready reference for what’s missing in the database. See linked docs for full detail.

---

## 1. Supabase Auth – Admin users

### Who was added (Auth only; no `public.users` table)

| Name            | Email                     | In Supabase Auth |
|-----------------|---------------------------|------------------|
| Nancy Cowans    | nancy@sokanacollective.com | Yes              |
| Sonia Collins   | sonia@sokanacollective.com | Yes              |

- Both exist in **Supabase Auth** (`auth.users`). They can sign in.
- **Temporary password (same for both):** `SokanaAdmin2025!ChangeMe`
- Share this via a secure channel. They should **change it on first login** (or use “Forgot password” to set a new one).

### If you add app roles later

- To treat them as **admins** in the app, you’d need a **`public.users`** table in Supabase (with `id`, `email`, `firstname`, `lastname`, `first_name`, `last_name`, `role = 'admin'`) and rows for these two. See `src/db/migrations/step1_minimal_users_table.sql` for the pattern. Right now no tables were created; only Auth was used.

---

## 2. Database – What’s missing (at a glance)

Full detail: **[MISSING_DATA_REPORT.md](./MISSING_DATA_REPORT.md)** and **[FINDINGS_REPORT_CLIENT_STATUS_AND_DOULAS.md](./FINDINGS_REPORT_CLIENT_STATUS_AND_DOULAS.md)**.

| Area | What’s missing | Remediation |
|------|----------------|-------------|
| **Payment–invoice link** | No FK from `payments` to `phi_invoices`. All 120 payments have `invoice_id` and `client_id` null. | Optional FK; backfill or set `invoice_id` / `client_id` when recording payments. |
| **Doulas** | No Supabase `public.users` (or doulas table in Cloud SQL). Backend expects doulas from Supabase. | Create and populate Supabase `public.users` (with role doula/admin) or add a doulas table in Cloud SQL and point backend at it. |
| **Assignments** | No `assignments` table in Cloud SQL or Supabase. Backend expects `doula_id`, `client_id`, `status`. | Add `assignments` (e.g. in Cloud SQL) and populate; or create and populate Supabase `public.assignments` (and `public.users`). |
| **Client status** | All 401 clients have `status = 'pending'`. 27 have paid/partial invoice but status not updated. | When ready: confirm the 27 and set status (e.g. active/complete); define process for the remaining 374. |
| **Edoula contracts** | Only URLs; no local copy of contract files. | Download when possible and store (e.g. in `phi_contracts` or chosen storage). Keep URLs in `.env` or secure backend store, not in repo. |

### Scripts to re-check

- Payment–invoice link (schema + counts):  
  `npx tsx scripts/verify-payment-invoice-customer-link.ts`
- Client status and payment evidence:  
  `npx tsx scripts/client-status-from-payments.ts`

(Both need Cloud SQL env and proxy if applicable.)

---

## 3. Quick reference – where things live

| Item | Where it lives / status |
|------|-------------------------|
| **Client list & status** | Cloud SQL `phi_clients` (`status`). All 401 currently `pending`. |
| **Payment evidence** | Cloud SQL `phi_invoices`. 27 clients have paid/partial; 374 do not. |
| **Payments** | Cloud SQL `payments`. Columns `client_id` and `invoice_id` exist but are not populated. |
| **Who the doulas are** | Not in current tables. Backend expects Supabase `public.users` (missing). |
| **Who is assigned to whom** | Backend expects `assignments` (Supabase or Cloud SQL). Table not present in either. |
| **Edoula contracts** | To migrate; store in your system and keep URLs out of repo. |
