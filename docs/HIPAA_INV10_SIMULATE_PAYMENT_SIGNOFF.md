# HIPAA-10 / INV-10 — Simulate-Payment Route Removal Sign-Off

**Ticket:** INV-10 — Disable simulated PAN/CVC payment route  
**Finding:** `POST /quickbooks/simulate-payment` accepted full card numbers and
CVC values.  
**Related:** `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`,
`docs/HIPAA_BOARD_TECHNICAL_STATUS.md`

---

## Scope verified

The legacy admin simulate-payment endpoint and all server-side PAN/CVC charge
helpers were **removed**. Card capture remains **browser-side tokenization
only** via Intuit hosted fields; the backend accepts **`intuit_token`** on
`POST /api/payment-methods` and never receives, stores, or logs PAN or CVC.

---

## Repository / config references

| Item                  | Location                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Route unmounted       | `src/routes/quickbooksRoutes.ts` — no `/simulate-payment` registration                   |
| Removed handlers      | `paymentsController`, `createCharge`, `buildChargePayload`, `src/api/simulate-payment.*` |
| Approved token path   | `src/routes/paymentMethodRoutes.ts` — `intuit_token` + `request_id` only                 |
| Token save controller | `src/controllers/paymentMethodController.ts`                                             |
| Frontend tokenization | `frontend-crm/src/features/billing/components/QuickBooksCardOnFileForm.tsx`              |
| Stale compiled route  | `src/routes/quickbooksRoutes.js` removed; `tsconfig.json` no longer includes it          |

---

## Automated test results

| Test file                                            | Coverage                                                                                  | Result                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| `src/__tests__/simulatePaymentRouteDisabled.test.ts` | Route 404 on both aliases; source scan; legacy file removal; tokenized path still mounted | **11/11 pass** (2026-08-25) |
| `src/__tests__/paymentMethodsMount.test.ts`          | `/api/payment-methods` mounted outside QB feature gate                                    | Existing                    |
| `frontend-crm/.../QuickBooksCardOnFileForm.test.tsx` | Browser tokenizes; only `intuit_token` sent to backend                                    | Existing (frontend)         |

**Negative privacy tests (backend):**

- Authenticated admin `POST /quickbooks/simulate-payment` → **404** (cannot
  process card payload).
- Authenticated admin `POST /api/quickbooks/simulate-payment` → **404**.
- Source scan: no `simulate-payment`, `createCharge`, or `buildChargePayload`
  registrations.
- Payment-methods schema rejects raw card fields; accepts `intuit_token` only.

---

## Production deployment

| Item             | Value                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Service          | `sokana-private-api`                                                     |
| Region           | `us-central1`                                                            |
| Project          | `sokana-private-data`                                                    |
| Serving revision | _Pending deploy after merge_ (current prod `00049-5wh` pre-INV-10 merge) |
| Git commit       | `11cf784` (INV-10 source removal)                                        |
| Pull request     | https://github.com/sokanacollectiveCRM/backend/pull/86                   |
| Cloud Build      | _Pending merge trigger_                                                  |

**Pre-merge production baseline (2026-08-25, revision `00049-5wh`):**

Production already returns **404** for simulate-payment because
`FEATURE_QUICKBOOKS=false` (QB router unmounted). `POST /api/payment-methods`
remains mounted (401 unauthenticated). Verified via
`scripts/verify-inv10-simulate-payment-prod.ts` — **6/6 pass**.

This does **not** close INV-10 alone: `main` still contains PAN/CVC handler
source until PR #86 merges and deploys.

**Post-deploy verification checklist:**

1. `POST /api/quickbooks/simulate-payment` with admin session → **404**.
2. `POST /quickbooks/simulate-payment` with admin session → **404**.
3. `POST /api/payment-methods` unauthenticated → **401** (route mounted, not
   404).
4. `POST /api/payment-methods` with valid `intuit_token` → **200** (tokenized
   workflow intact).
5. Confirm no application logs contain card number or CVC patterns on payment
   flows.
6. Re-run:
   `BACKEND_URL=https://sokana-private-api-....run.app npx tsx scripts/verify-inv10-simulate-payment-prod.ts`

---

## Residual risk (acknowledged)

- **Historical exposure:** Prior deployments may have processed PAN/CVC through
  the removed route in sandbox; no CRM persistence of raw card data was
  intended, but prior log retention should be reviewed under PCI/HIPAA log
  policies.
- **Third-party tokenization:** Approved path relies on Intuit browser SDK;
  backend never sees PAN/CVC when frontend follows the tokenized workflow.

---

## Sign-off

| Field             | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| **Reviewer**      | _Pending reviewer_                                              |
| **Role**          | Engineering verification / compliance reviewer                  |
| **Sign-off date** | _Pending production verification_                               |
| **Status**        | **Code complete — pending production deploy & formal sign-off** |

---

## Change log

| Date       | Change                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| 2026-08-25 | Route unmounted; PAN/CVC handler modules removed; negative tests added      |
| 2026-08-25 | PR #86 opened (`11cf784`); pre-deploy prod baseline 6/6 pass on `00049-5wh` |
