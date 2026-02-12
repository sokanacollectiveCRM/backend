# Frontend: Reconciliation – Full Implementation Prompt

Use this document to implement the **Reconciliation** feature on the frontend. The backend already exposes a read-only reconciliation API that matches invoices and payments by amount and returns suggested links plus summary totals (from the invoice table only). The frontend should display these results, allow filtering and CSV export, and prepare the UX for future “confirm and write” (no write in this phase).

---

## 1. Backend API contract

### Base URL and auth

- **Base URL:** Same as the rest of your app (e.g. `process.env.REACT_APP_API_URL` or your API client base).
- **Auth:** Send the same auth as other protected endpoints: **cookie** (e.g. `sb-access-token`) with `credentials: 'include'`, or **Bearer token** in `Authorization` header. Roles: **admin** or **doula** (same as Payments/Invoices).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| **GET** | `/api/financial/reconciliation` | Returns JSON: suggested links (invoices ↔ payments) and summary totals. |
| **GET** | `/api/financial/reconciliation?format=csv` | Same data as CSV; use for download. |
| **GET** | `/api/financial/reconciliation/csv` | Same as `?format=csv`; returns CSV with `Content-Disposition: attachment`. |

### Query parameters (all optional)

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max invoices to consider (default 500, max 1000). |
| `invoice_status` | string | Filter by invoice status (e.g. `PAID`, `PENDING`, `PARTIAL`). |
| `date_from` | string | `YYYY-MM-DD`; filter invoices by date (created_at/due_date). |
| `date_to` | string | `YYYY-MM-DD`; filter invoices by date. |

### Response envelope (JSON)

```ts
{
  success: true,
  data: ReconciliationRow[],
  summary: ReconciliationSummary
}
```

- **`data`** – Array of reconciliation rows (one per invoice that has at least one matching payment by amount). Suggestions only; no data is written by this endpoint.
- **`summary`** – Totals for **invoices** (total amount, count, pending/paid amounts and counts) and **payments** (total amount, count, pending/paid amounts and counts). No new DB columns.

---

## 2. TypeScript types (align with backend)

Use these types on the frontend. All keys are **snake_case** as returned by the API.

```ts
// One row per invoice that has at least one payment matching by amount
export interface ReconciliationRow {
  invoice_id: string;
  invoice_number: string;
  invoice_customer: string;
  invoice_amount: number;
  invoice_status: string;            // normalized: "paid" | "pending"
  invoice_status_raw: string | null; // from invoice table: e.g. PAID, PENDING, PARTIAL
  invoice_created_at: string | null; // ISO 8601
  invoice_due_date: string | null;   // YYYY-MM-DD
  match_type: 'amount_only' | 'amount_and_customer';
  payment_ids: string[];
  payment_customers: string[];
  payment_amounts: number[];
  payment_created_dates: (string | null)[]; // ISO 8601, same order as payment_ids
}

// Invoice totals + pending/paid (from phi_invoices); payment totals; status breakdown from invoice table
export interface ReconciliationSummary {
  total_invoice_amount: number;
  total_invoice_count: number;
  total_pending_amount: number;
  total_paid_amount: number;
  total_pending_count: number;
  total_paid_count: number;
  invoice_status_breakdown: Record<string, number>; // e.g. { PAID: 35, PENDING: 10, PARTIAL: 5 }
  payment_total_amount: number;
  payment_count: number;
  payment_total_pending_amount: number;
  payment_total_paid_amount: number;
  payment_pending_count: number;
  payment_paid_count: number;
}

export interface ReconciliationApiResponse {
  success: boolean;
  data: ReconciliationRow[];
  summary: ReconciliationSummary;
}
```

---

## 3. What to build (UI)

### 3.1 Reconciliation page or section

- Add a **Reconciliation** entry to nav/sidebar (e.g. under “Financial” or “Payments”) that routes to a reconciliation view.
- Page title: e.g. “Reconciliation” or “Invoices ↔ Payments”.

### 3.2 Summary block (at a glance)

Display **invoice totals** and **payment totals** from **`response.summary`**, including pending amounts and counts:

**Invoices (phi_invoices)** — all from invoice table; pending/paid derived from `phi_invoices.status`:

| Label | Source |
|-------|--------|
| Total invoice amount | `summary.total_invoice_amount` |
| Total invoice count | `summary.total_invoice_count` |
| Total pending (amount) | `summary.total_pending_amount` |
| Total paid (amount) | `summary.total_paid_amount` |
| Pending count | `summary.total_pending_count` |
| Paid count | `summary.total_paid_count` |
| Status breakdown | `summary.invoice_status_breakdown` — e.g. `{ PAID: 35, PENDING: 10, PARTIAL: 5 }` (raw status from invoice table) |

**Payments (payments table):**

| Label | Source |
|-------|--------|
| Total payment amount | `summary.payment_total_amount` |
| Payment count | `summary.payment_count` |
| Payment pending (amount) | `summary.payment_total_pending_amount` |
| Payment paid (amount) | `summary.payment_total_paid_amount` |
| Payment pending count | `summary.payment_pending_count` |
| Payment paid count | `summary.payment_paid_count` |

- Use cards or a summary bar (e.g. two sections: Invoices | Payments). Format amounts as currency (2 decimals).

### 3.3 Filters (optional but recommended)

- **Limit:** number input or select (e.g. 100, 500, 1000). Send as `limit`.
- **Invoice status:** dropdown or chips (e.g. All, PAID, PENDING, PARTIAL). Send as `invoice_status`.
- **Date range:** `date_from` and `date_to` (date inputs or pickers). Send as `YYYY-MM-DD`.

On change, refetch `GET /api/financial/reconciliation` with the new query params and update the table and summary.

### 3.4 Main table (reconciliation rows)

- **Data source:** `response.data` (array of `ReconciliationRow`).
- **Columns (suggested):**

| Column | Field(s) | Notes |
|--------|----------|--------|
| Invoice | `invoice_number`, `invoice_id` | Link or tooltip with id if useful. |
| Customer | `invoice_customer` | From invoice; suggested for payment. |
| Amount | `invoice_amount` | Format as currency. |
| Status | `invoice_status` (normalized), `invoice_status_raw` | Use `invoice_status_raw` for display (e.g. PAID, PENDING, PARTIAL); `invoice_status` for logic (paid/pending). |
| Invoice date | `invoice_created_at` | Format with your date helper (e.g. toLocaleDateString). |
| Due date | `invoice_due_date` | Same. |
| Match type | `match_type` | `amount_only` vs `amount_and_customer` (e.g. badge or label). |
| Matched payments | `payment_ids`, `payment_customers`, `payment_amounts`, `payment_created_dates` | Show count and/or expandable list: id, customer, amount, date per payment. |

- **Empty state:** If `data.length === 0`, show a message like “No invoice–payment matches for the current filters.”
- **Loading / error:** Show loading state while fetching; on error (e.g. 401, 500), show error message and optionally a retry button.

### 3.5 Dates and formatting

- Use a single **formatDate** helper for `invoice_created_at`, `invoice_due_date`, and each `payment_created_dates[i]`: if value is null/undefined/empty, show “—”; otherwise parse and display (e.g. `toLocaleDateString()`), and avoid showing “Invalid Date”.
- Format all amounts to 2 decimal places (e.g. `$1,234.56`).

### 3.6 CSV download

- **Button or link:** e.g. “Download CSV” or “Export”.
- **Behavior:** Open or fetch the CSV endpoint with the **same query params** as the current table (limit, invoice_status, date_from, date_to). Options:
  - **Option A:** `window.open(apiBase + '/api/financial/reconciliation/csv?' + new URLSearchParams(currentFilters), '_blank')` with credentials if needed (may require same-origin or backend CORS for cookie).
  - **Option B:** `fetch(apiBase + '/api/financial/reconciliation?format=csv&' + new URLSearchParams(currentFilters), { credentials: 'include' })` then create a blob and trigger download (e.g. filename `reconciliation.csv`).

### 3.7 Confirmation (future)

- This API **does not write** to the payments table. The UI should present the data as **suggestions**.
- You can add a note or placeholder such as “Confirm and apply to payments” that is disabled or points to a future flow (e.g. a separate endpoint or action that will update payment customer/status/dates after user confirmation). No implementation of that write step is required for this prompt.

---

## 4. Implementation steps (checklist)

1. **API client**
   - Add a function that calls `GET /api/financial/reconciliation` with optional `limit`, `invoice_status`, `date_from`, `date_to`.
   - Use the same auth as other API calls (cookie or Bearer).
   - Parse JSON and return `{ data, summary }` or the full `ReconciliationApiResponse`; handle non-OK and `success: false`.

2. **Types**
   - Add or duplicate the types above (`ReconciliationRow`, `ReconciliationSummary`, `ReconciliationApiResponse`) in your frontend (e.g. `src/api/financial/reconciliationApi.ts` or `src/types/reconciliation.ts`).

3. **Reconciliation page / route**
   - Create a route (e.g. `/financial/reconciliation` or `/reconciliation`) and a page component that will hold the summary, filters, table, and CSV button.

4. **Summary block**
   - On load (and when filters change), fetch reconciliation and render the four summary values from `response.summary`. Format amounts and counts.

5. **Filters**
   - Add limit, invoice_status, and date range controls. Store filter state and pass it to the API client. Refetch when filters change (and on initial load).

6. **Table**
   - Render `response.data` in a table with the columns above. Use `formatDate` for all date fields. For matched payments, show at least count and optionally an expandable or tooltip list of payment id, customer, amount, date.

7. **CSV download**
   - Add a button that requests the same endpoint with `format=csv` or `/reconciliation/csv` and the current filters, then triggers a file download with filename `reconciliation.csv`.

8. **Loading and error states**
   - Show a loading indicator while the request is in progress. On error, show a message and optionally retry.

9. **Navigation**
   - Add a link/entry to the Reconciliation page from your nav or Financial section.

---

## 5. Quick reference: API call examples

**JSON (for table and summary):**

```ts
const params = new URLSearchParams();
if (limit) params.set('limit', String(limit));
if (invoiceStatus) params.set('invoice_status', invoiceStatus);
if (dateFrom) params.set('date_from', dateFrom);
if (dateTo) params.set('date_to', dateTo);
const res = await fetch(`${API_BASE}/api/financial/reconciliation?${params}`, {
  credentials: 'include',
  headers: { Accept: 'application/json' },
});
const json = await res.json();
if (!res.ok || !json.success) throw new Error(json.error || 'Reconciliation failed');
const { data, summary } = json;
```

**CSV (for download):**

```ts
const params = new URLSearchParams();
// same params as above
const url = `${API_BASE}/api/financial/reconciliation/csv?${params}`;
const res = await fetch(url, { credentials: 'include' });
const blob = await res.blob();
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'reconciliation.csv';
a.click();
URL.revokeObjectURL(a.href);
```

---

## 6. Summary

- **Endpoint:** GET `/api/financial/reconciliation` (and `/api/financial/reconciliation/csv` or `?format=csv`).
- **Auth:** Same as Payments/Invoices (cookie or Bearer; admin/doula).
- **Response:** `{ success, data: ReconciliationRow[], summary: ReconciliationSummary }`; summary includes **invoice totals** (total amount, count, pending/paid) and **payment totals** (total amount, count, pending/paid). No new DB columns.
- **UI:** Summary block (4 numbers), optional filters (limit, invoice_status, date_from, date_to), table of reconciliation rows, format dates and amounts, CSV download with same filters. Treat data as suggestions; no write from this endpoint.
- **Types:** Use the snake_case types above so the frontend matches the backend contract.

This gives you a full specification to implement the reconciliation feature on the frontend against the existing backend.
