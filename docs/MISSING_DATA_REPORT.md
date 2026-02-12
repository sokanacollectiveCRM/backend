# Missing Data Report

**Purpose:** Single place to see what data is missing or incomplete so you can prioritize backfill, schema changes, or new sources.

---

## 1. Payment ↔ Invoice connection

### Schema: no enforced link

| Item | Status | Detail |
|------|--------|--------|
| **Foreign key** from `payments` to `phi_invoices` | **Missing** | The DB does **not** enforce that `payments.invoice_id` references `phi_invoices.id`. Connection is by convention only. |
| **Foreign key** from `payments` to `phi_clients` | Present | `payments.client_id` → `phi_clients.id` is enforced. |

So nothing in the schema **determines** that a payment row is tied to an invoice row. To enforce it you’d add:

```sql
-- Optional: enforce payment → invoice (fix type mismatch first if needed)
ALTER TABLE payments
  ADD CONSTRAINT payments_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES phi_invoices(id);
```

### Data: connection columns empty

| Item | Count | Meaning |
|------|--------|--------|
| **Total payment rows** | 120 | Table has data. |
| **Payments with `client_id` set** | **0** | No payment is linked to a client. |
| **Payments with `invoice_id` set** | **0** | No payment is linked to an invoice. |

So **all** payment records are missing the fields that would connect them to a customer and to an invoice. The columns exist; they are not populated.

**Remediation:** Backfill or application logic so that:

- `payments.client_id` is set to the paying client (or derived from the invoice), and/or  
- `payments.invoice_id` is set to `phi_invoices.id` when the payment is for that invoice.

Ensure `payments.invoice_id` and `phi_invoices.id` use the same type (e.g. both UUID or both integer) so joins and any future FK work.

---

## 2. Doulas (who the doulas are)

| Item | Status | Detail |
|------|--------|--------|
| **Supabase `public.users`** | **Missing** | Backend expects doulas here; table does not exist or is not visible. |
| **Cloud SQL users/doulas table** | **Missing** | No doulas table in Cloud SQL. |

**Remediation:** Either create and populate Supabase `public.users` (with role doula/admin) or add a doulas/users table in Cloud SQL and point the backend at it.

---

## 3. Assignments (who is assigned to whom)

| Item | Status | Detail |
|------|--------|--------|
| **Cloud SQL `assignments`** | **Missing** | Not among the current Cloud SQL tables. |
| **Supabase `public.assignments`** | **Missing / not in use** | Backend expects it with `doula_id`, `client_id`, `status`; not available. |

**Remediation:** Add an `assignments` table (e.g. in Cloud SQL: `doula_id`, `client_id`, `status`, `assigned_at`) and populate it; or create and populate Supabase `public.assignments` (and `public.users`) and use the existing Supabase-based assignment code.

---

## 4. Client status (pending only)

| Item | Count | Meaning |
|------|--------|--------|
| **Clients with paid/partial invoice** | 27 | Have payment evidence; status still `pending`. |
| **Clients with no paid invoice** | 374 | No payment evidence in `phi_invoices`. |
| **Clients with status ≠ pending** | 0 | All 401 clients have `status = 'pending'`. |

**Remediation:** When you’re ready: (a) confirm the 27 with paid invoices and set status (e.g. active/complete); (b) define process for the remaining 374.

---

## 5. Edoula contracts (migration)

| Item | Status | Detail |
|------|--------|--------|
| **Contract records in your system** | **Missing** | Contracts live on edoula; you have URLs only. |
| **Storage** | To migrate | Download when possible and store in your system (e.g. `phi_contracts` or chosen storage). Keep URLs out of the repo (e.g. `.env` or secure backend store). |

---

## 6. Summary: missing data at a glance

| Area | What’s missing | Remediation |
|------|----------------|------------|
| **Payment–invoice link** | No FK; all 120 payments have `invoice_id` and `client_id` null | Optional FK; backfill or set `invoice_id` / `client_id` when recording payments. |
| **Doulas** | No `public.users` (Supabase) or doulas table (Cloud SQL) | Create and populate one of these. |
| **Assignments** | No `assignments` in Cloud SQL or Supabase | Add table and populate. |
| **Client status** | All 401 pending; 27 have payment evidence but status not updated | Confirm and set status when ready. |
| **Edoula contracts** | Only URLs; no local copy | Download and store; keep URLs in `.env` or secure store. |

---

## Scripts to re-check

- **Payment–invoice link (schema + counts):**  
  `npx tsx scripts/verify-payment-invoice-customer-link.ts`
- **Client status and payment evidence:**  
  `npx tsx scripts/client-status-from-payments.ts`

Both require Cloud SQL env (and proxy if applicable).
