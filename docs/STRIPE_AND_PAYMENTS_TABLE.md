# Stripe endpoint and Cloud SQL payments table

## Is the Stripe endpoint updated?

**Yes.** The charge flow already writes to **Google Cloud SQL**:

- **Endpoint:** `POST /api/payments/customers/:customerId/charge` (when `FEATURE_STRIPE` is true).
- **Flow:** `paymentController.processCharge` → `StripePaymentService.chargeCard` → on success calls **`insertPaymentToCloudSql`** and records the payment in the Cloud SQL **`payments`** table.
- **Still using Supabase for:** customer lookup (`customers`), payment method lookup (`payment_methods`), and writing to `charges` (and QuickBooks sync reads from that). Removing those is part of the Supabase → Cloud SQL migration (see `SUPABASE_TO_CLOUDSQL_MIGRATION_PLAN.md`).

So: **Stripe charges are persisted to the Cloud SQL `payments` table**; the endpoint is updated for that. Full removal of Supabase for billing (customers, payment_methods, charges) is a later phase.

---

## Does the payments table in Cloud SQL need to be updated?

**If the table doesn’t exist yet, create it.** There was no `payments` table in the step3 Cloud SQL schema. Use this migration:

- **File:** `migrations/create_payments_table_cloudsql.sql`
- **Columns:**  
  `id`, `txn_date`, `amount`, `method`, `gateway`, `transaction_id`, `client_id`, and optionally `invoice_id`, `invoice`, `contract_id`, `description`.

**If the table already exists** with at least:

- `id`, `txn_date`, `amount`, `method`, `gateway`, `transaction_id`, `client_id`

then no change is required for the current Stripe insert. If you want invoice/contract linking and description in the list and reconciliation, add the optional columns (the migration includes them; the repo’s list query already supports `invoice_id`, `invoice`, `contract_id` with a fallback when they’re missing).

**Run the migration** in your Cloud SQL DB (e.g. `sokana_private`) if you haven’t already:

```bash
# Example: run against your Cloud SQL instance
psql "host=... port=5433 dbname=sokana_private user=app_user" -f migrations/create_payments_table_cloudsql.sql
```

---

## Summary

| Question | Answer |
|----------|--------|
| Is the Stripe charge endpoint updated? | Yes – it writes to Cloud SQL `payments` via `insertPaymentToCloudSql` on success. |
| Does the payments table need to be created/updated? | Create it with `migrations/create_payments_table_cloudsql.sql` if it doesn’t exist. Optional columns for invoice/contract/description are included; add them to an existing table only if you want them. |
