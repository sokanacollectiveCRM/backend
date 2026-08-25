# HIPAA-13G / INV-10 — Simulate-Payment Route Removal Sign-Off

**Ticket:** INV-10 / HIPAA-13G — Disable simulated PAN/CVC payment route  
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

## Production environment

| Item             | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Service          | `sokana-private-api`                                                          |
| Region           | `us-central1`                                                                 |
| Project          | `sokana-private-data`                                                         |
| Serving revision | `sokana-private-api-00051-2vz`                                                |
| Git merge commit | `08e0894` (PR #86, 2026-08-25)                                                |
| Cloud Build      | SUCCESS `2026-08-25T22:11:28Z` (build `08ae7c44-5dc7-4712-812e-a59407db7abd`) |
| Pull request     | https://github.com/sokanacollectiveCRM/backend/pull/86                        |

---

## Verification results (2026-08-25)

| Test                                                     | Expected      | Observed              | Result |
| -------------------------------------------------------- | ------------- | --------------------- | ------ |
| Unauthenticated `POST /api/quickbooks/simulate-payment`  | 404           | 404                   | Pass   |
| Unauthenticated `POST /quickbooks/simulate-payment`      | 404           | 404                   | Pass   |
| Unauthenticated `POST /api/payment-methods`              | 401 (mounted) | 401 `UNAUTHENTICATED` | Pass   |
| Admin `POST /api/quickbooks/simulate-payment`            | 404           | 404                   | Pass   |
| Admin `POST /quickbooks/simulate-payment`                | 404           | 404                   | Pass   |
| Admin `POST /api/payment-methods` (invalid token)        | not 404       | 403 (route mounted)   | Pass   |
| Automated tests (`simulatePaymentRouteDisabled.test.ts`) | 11/11         | 11/11 pass            | Pass   |
| Prod script (`verify-inv10-simulate-payment-prod.ts`)    | 6/6           | 6/6 pass              | Pass   |

---

## Repository / config references

| Item                  | Location                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Route unmounted       | `src/routes/quickbooksRoutes.ts` — no `/simulate-payment` registration                   |
| Removed handlers      | `paymentsController`, `createCharge`, `buildChargePayload`, `src/api/simulate-payment.*` |
| Approved token path   | `src/routes/paymentMethodRoutes.ts` — `intuit_token` + `request_id` only                 |
| Token save controller | `src/controllers/paymentMethodController.ts`                                             |
| Prod verification     | `scripts/verify-inv10-simulate-payment-prod.ts`                                          |
| Tests                 | `src/__tests__/simulatePaymentRouteDisabled.test.ts`                                     |

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

I confirm that INV-10 / HIPAA-13G has been **implemented, deployed to
production, and verified** as described above. Simulate-payment routes return
404; tokenized card-on-file via `/api/payment-methods` remains mounted.

| Field             | Value                                          |
| ----------------- | ---------------------------------------------- |
| **Reviewer**      | Jerry Bony                                     |
| **Role**          | Engineering verification / compliance reviewer |
| **Sign-off date** | 2026-08-25                                     |
| **Status**        | **Verified — closed**                          |

---

## Change log

| Date       | Change                                                               |
| ---------- | -------------------------------------------------------------------- |
| 2026-08-25 | Route unmounted; PAN/CVC handlers removed; negative tests added      |
| 2026-08-25 | PR #86 merged (`08e0894`); Cloud Build SUCCESS; revision `00051-2vz` |
| 2026-08-25 | Production verification 6/6 pass; formal sign-off — Jerry Bony       |
