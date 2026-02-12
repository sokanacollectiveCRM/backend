# Backend billing / Stripe charge – spec & checklist

This document describes what the backend must provide for the Billing UI to charge a client’s card (Stripe). The frontend is already wired to **POST `/api/payments/customers/:customerId/charge`** with auth.

---

## 1. Frontend flow

- Billing page uses **clients with signed contracts** (from GET /clients).
- Admin picks a **client** (your app client UUID), **amount (USD)**, and **description**.
- Frontend calls **POST `/api/payments/customers/:customerId/charge`** with body `{ amount, description }` (amount in **cents**) and sends auth (cookie or Bearer).

**Note:** If your Billing UI uses **client id** (from GET /clients), then either:
- **Option A:** Backend accepts **client id** as `customerId` and resolves it to your internal customer / Stripe customer (e.g. via a `customers` or `clients` table that has `stripe_customer_id`), or  
- **Option B:** Frontend sends the **customer id** that already has a Stripe customer (e.g. from GET /api/payments/customers).  

Current backend implementation uses a **customers** table (Supabase) with `stripe_customer_id`; `customerId` in the route is the **customer** row id. If clients and customers are the same entity, use the same id; otherwise add a mapping (client id → customer id) in backend or frontend.

---

## 2. Stripe setup

- **One Stripe Customer per chargeable client/customer.**  
- Store **Stripe Customer ID** (e.g. `stripe_customer_id`) on the client/customer record.  
- When a client adds a card (e.g. in portal or admin flow), set that card as the **default payment method** for the Stripe customer so “charge default” works.

---

## 3. Charge endpoint

**POST `/api/payments/customers/:customerId/charge`**

- **`:customerId`** = your app **customer** (or client) id. Backend resolves this to a Stripe Customer (e.g. via `stripe_customer_id` on the customer/client record).
- **Body:** `{ amount: number (cents), description?: string }`.
- **Auth:** Required; same as rest of app (cookie or Bearer). Backend should require **admin** (or allow the customer themselves for self-serve). Current implementation allows **admin** or **same user as customerId**.
- **Backend must:**
  1. Resolve `customerId` → Stripe Customer (using stored `stripe_customer_id`).
  2. Charge that customer’s **default payment method** (Stripe Payment Intents or Charges API).
  3. Return **`{ success: true, data }`** or **`{ success: false, error }`** so the Billing UI can show success or error.

**Errors (clear responses):**

- Client/customer has **no Stripe customer** → 400 or 404 with message like “No Stripe customer for this client.”
- **No default payment method** → 400 with message like “No payment method on file. Add a card first.”

---

## 4. Persistence

- **Supabase `charges`** – The charge is still saved to Supabase `charges` for existing integrations (e.g. QuickBooks sync).
- **Google Cloud SQL `payments`** – After a successful Stripe charge, the payment is **also** recorded in Cloud SQL table **`payments`** (columns: `txn_date`, `amount` [dollars], `method`, `gateway` = 'stripe', `transaction_id` = Stripe payment intent id, `client_id` = customerId). This makes charges visible in **GET /api/payments** and in reconciliation. If Cloud SQL is unavailable or the insert fails, the charge still succeeds; the failure is logged and the response is unchanged.
- **Card CRUD** (save card, list cards, update card) can use the same `customerId` (app customer/client id) and same auth.

---

## 5. Backend checklist

| Item | Purpose |
|------|--------|
| Store `stripe_customer_id` per customer/client | Map app customer id → Stripe Customer |
| Set default payment method when client adds a card | So “charge default” works |
| **POST /api/payments/customers/:customerId/charge** | Accept customer id, body `{ amount, description }`; resolve to Stripe and charge default payment method |
| Require admin (or allowed role) on charge | Auth same as rest of app (cookie/Bearer) |
| Return `{ success, data \| error }` | So Billing UI can show success or error |
| Save charge in Cloud SQL `payments` table | Done after successful Stripe charge; visible in GET /api/payments and reconciliation |

---

## 6. Current implementation status

- **StripePaymentService** (`src/services/payments/stripePaymentService.ts`): `ensureStripeCustomer`, `chargeCard`, `saveCard`, `getPaymentMethods`; uses Supabase **customers** table and `stripe_customer_id`.
- **PaymentController** (`src/controllers/paymentController.ts`): `processCharge` calls `paymentService.chargeCard({ customerId, amount, description })`; auth: admin or same user as `customerId`; returns `{ success, data }` or `{ success, error }`.
- **Route:** Must be mounted under `/api/payments` as **POST `/customers/:customerId/charge`** (see `src/routes/paymentRoutes.ts`). When Stripe is enabled, this route is registered so the Billing UI works end-to-end.
