# Portal Readiness — Lean Test Plan

Manual test plan for **portal eligibility / onboarding readiness** while aligning the CRM frontend. Optimized for repeat runs with minimal cost.

**Do not start with QuickBooks.** Start with the backend API as the oracle.

## Cheapest proof path

1. Pick one fixture client
2. Reset that client’s DB state
3. Force one scenario with SQL
4. Call `GET /api/clients/:id`
5. Compare the API response to expected readiness
6. Then check the frontend UI

---

## Prerequisites

| Item | Notes |
|------|--------|
| Cloud SQL Proxy | `127.0.0.1:5433` → `sokana_private` (see `.cursor/skills/sokana-cloudsql-local-connect/SKILL.md`) |
| Backend | `npm run dev` (default ~`http://localhost:5050`) |
| Frontend CRM | Points at same API base URL |
| Migration applied | `create_client_onboarding_readiness.sql` |

**Legacy warning:** `scripts/make-client-eligible-for-portal.sql` targets Supabase `contracts` / `contract_payments`. This flow uses Cloud SQL `phi_contracts`, `payment_installments`, `payments`, and `client_onboarding_readiness`.

---

## Step 1: Choose one fixture client

**Default dev fixture (client login + Cloud SQL linked):**

| Field | Value |
|-------|--------|
| Email | `jbony@icstars.org` |
| Name | Jordan Bony |
| Supabase role | **`client`** |
| `CLIENT_ID` | `1d981375-beeb-46e7-bf22-5d7a750eb391` |
| `CLIENT_AUTH_USER_ID` | `a4c3b92a-1e01-4f0c-b3da-c7e7a3506d2d` |
| `payment_method` | `Medicaid` → billing path `medicaid` |
| `qbo_customer_id` | `90` |
| Staff `AUTH_TOKEN` | Log in as **admin** (`info@techluminateacademy.com`) for API/curl |

**Alternate lead-only fixture** (no Supabase auth): `jerry@techluminateacademy.com` / `0e705105-6d48-4b8d-b16d-24061e59b6db`

Record for your session:

- `CLIENT_ID`
- `QBO_CUSTOMER_ID` (if available on `phi_clients.qbo_customer_id`)
- `API_BASE_URL` (probably `http://localhost:5050`)
- `AUTH_TOKEN` (admin JWT for staff endpoints)

Export variables (or copy `scripts/test/.env.test-readiness.example` → `.env.test-readiness`):

```bash
export API_BASE_URL="http://localhost:5050"
export CLIENT_ID="1d981375-beeb-46e7-bf22-5d7a750eb391"   # jbony@icstars.org
export AUTH_TOKEN="paste-admin-jwt-from-login"
```

### Recommended: use the helper script (loads .env, validates UUID)

```bash
chmod +x scripts/test/run-portal-readiness-scenario.sh
# Default CLIENT_ID is Jordan if unset
./scripts/test/run-portal-readiness-scenario.sh medicaid-eligible-no-card
```

For Self-Pay missing-card testing on the same client (overwrites payment_method):

```bash
./scripts/test/run-portal-readiness-scenario.sh selfpay-missing-card
```

### Find another fixture client id

```bash
source .env && PGPASSWORD="$CLOUD_SQL_PASSWORD" psql -h 127.0.0.1 -p 5433 -U app_user -d sokana_private \
  -c "SELECT id, first_name, last_name, email, payment_method FROM phi_clients ORDER BY updated_at DESC LIMIT 5;"
```

---

## Step 2: Verify the API returns readiness fields

Before touching SQL, check what the backend returns today:

```bash
curl -s "$API_BASE_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{
    id,
    billing_path,
    is_eligible,
    portal_blockers,
    primary_portal_blocker,
    payment_authorization_required,
    payment_authorization_satisfied,
    card_on_file,
    qb_customer_id,
    qb_stored_payment_method_id,
    verification_invoice_id,
    verification_invoice_sent_at,
    verification_invoice_paid_at,
    allowed_actions
  }'
```

**Expected:** all fields should exist (some may be `null`).

**If fields are missing:** stop — fix the backend API contract before frontend testing.

### First command to run

```bash
curl -s "$API_BASE_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{
    id,
    billing_path,
    is_eligible,
    portal_blockers,
    primary_portal_blocker,
    allowed_actions
  }'
```

If this response is clean, continue with SQL scenarios. If not, the next move is backend contract work, not UI work.

---

## Step 3: First test scenario (money case)

**Insurance / Self-Pay + signed contract + paid deposit + no card**

| Field | Expected |
|-------|----------|
| `is_eligible` | `false` |
| `primary_portal_blocker` | `missing_card_on_file` |
| `allowed_actions.can_invite_to_portal` | `false` |
| `allowed_actions.can_send_verification_invoice` | `true` |

---

## Step 4: Flip the DB into that state

Schema notes:

- Deposit gate reads `payment_installments` via `payment_schedules` → `phi_contracts`, **or** any row in `payments` with `client_id`.
- Installment column is `payment_type` (not `type`); installments link to `schedule_id`, not `client_id`.
- `client_payment_methods` uses `quickbooks_customer_id`, `provider_payment_method_reference`, `card_brand`, `last4`, `exp_month`, `exp_year`, `status`.

### Option A — Run the prepared script (recommended)

```bash
export CLIENT_ID="your-real-uuid-here"
./scripts/test/run-portal-readiness-scenario.sh selfpay-missing-card
```

**Do not** pass extra quotes: wrong `-v client_id="'$CLIENT_ID'"` produces `'''your-uuid'''` and fails. Use `-v client_id="$CLIENT_ID"` or the helper script above.

### Option B — Inline SQL (reference)

See `scripts/test/scenario-selfpay-missing-card.sql` for the canonical version. It:

1. Sets `phi_clients.payment_method = 'Self-Pay'`
2. Ensures a signed `phi_contracts` row
3. Ensures a paid deposit installment (or legacy `payments` row)
4. Deletes `client_payment_methods`
5. Clears `client_onboarding_readiness` / `client_onboarding_events` for a clean recompute

### Reset between scenarios

```bash
export CLIENT_ID="your-real-uuid-here"
./scripts/test/run-portal-readiness-scenario.sh reset
```

---

## Step 5: Trigger recomputation

**Current backend behavior:** `GET /api/clients/:id` calls `portalEligibilityService.getPortalEligibility()`, which recomputes and persists readiness on each detail fetch.

```bash
curl -s "$API_BASE_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{
    billing_path,
    is_eligible,
    portal_blockers,
    primary_portal_blocker,
    payment_authorization_required,
    payment_authorization_satisfied,
    card_on_file,
    allowed_actions
  }'
```

**Expected (Self-Pay missing card):**

```json
{
  "billing_path": "self_pay",
  "is_eligible": false,
  "primary_portal_blocker": "missing_card_on_file",
  "payment_authorization_required": true,
  "payment_authorization_satisfied": false,
  "card_on_file": false,
  "allowed_actions": {
    "can_invite_to_portal": false,
    "can_send_verification_invoice": true,
    "can_mark_contract_signed": false,
    "can_mark_deposit_paid": false
  }
}
```

If data looks stale after SQL + GET, confirm Cloud SQL proxy connectivity and that `CLIENT_ID` matches the rows you updated. List endpoint (`GET /api/clients`) also recomputes per client but is heavier for debugging — prefer detail GET.

---

## Step 6: Test the staff action

When blocked by `missing_card_on_file`:

```bash
curl -s -X POST \
  "$API_BASE_URL/api/clients/$CLIENT_ID/billing/send-verification-invoice" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
```

**Expected:**

```json
{
  "success": true,
  "data": {
    "verification_invoice_id": "some-qbo-id",
    "payment_link": "optional-link"
  }
}
```

(Wrap shape depends on `ApiResponse.success` — inspect full JSON if nested under `data`.)

Re-fetch:

```bash
curl -s "$API_BASE_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{
    verification_invoice_id,
    verification_invoice_sent_at,
    allowed_actions
  }'
```

You should see `verification_invoice_id` and `verification_invoice_sent_at` populated.

**Note:** This step calls real QuickBooks unless you mock/stub QBO in dev. For UI-only iteration, skip Step 6 until API-only scenarios pass.

---

## Step 7: Test card-on-file unlock (no real QBO charge)

### 7a. Insert stored payment method metadata

Use the client’s real `qbo_customer_id` when available:

```bash
./scripts/test/run-portal-readiness-scenario.sh add-card
```

### 7b. Simulate verification invoice paid webhook

Use the `verification_invoice_id` from Step 6, or a test id if you set one on the readiness row:

```bash
curl -s -X POST \
  "$API_BASE_URL/api/quickbooks/webhooks/invoice-paid" \
  -H "Content-Type: application/json" \
  -d "{
    \"qbo_invoice_id\": \"verification_invoice_test_123\",
    \"client_id\": \"$CLIENT_ID\",
    \"balance\": 0
  }" | jq '.'
```

If testing the verification flow end-to-end, replace `qbo_invoice_id` with the id returned from Step 6 and ensure `client_onboarding_readiness.verification_invoice_id` matches.

### 7c. Re-fetch

```bash
curl -s "$API_BASE_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{
    is_eligible,
    portal_blockers,
    primary_portal_blocker,
    payment_authorization_satisfied,
    card_on_file,
    allowed_actions
  }'
```

**Expected after card + verification webhook:**

```json
{
  "is_eligible": true,
  "portal_blockers": [],
  "primary_portal_blocker": null,
  "payment_authorization_satisfied": true,
  "card_on_file": true,
  "allowed_actions": {
    "can_invite_to_portal": true,
    "can_send_verification_invoice": false
  }
}
```

---

## Step 8: Check the frontend

Open the CRM and inspect the same `CLIENT_ID`.

| Scenario | UI expectations |
|----------|-----------------|
| Missing card | “Missing card on file” (or equivalent); portal invite **disabled**; send $1 verification invoice **visible** |
| Eligible | Eligible state; portal invite **enabled**; verification invoice action **hidden** |

Confirm the network tab shows backend fields — not client-side reconstruction from legacy `contracts` / `payments` arrays.

---

## Start with only these 5 scenarios

Do not test everything on day one. These prove the architecture:

| Scenario | Expected |
|----------|----------|
| Self-Pay + signed + paid deposit + no card | Blocked: `missing_card_on_file` |
| Self-Pay + signed + paid deposit + card | Eligible |
| Medicaid + signed + paid deposit + no card | Eligible |
| Self-Pay + unsigned + unpaid + no card | Blocked: `contract_unsigned` (deposit may add `deposit_unpaid`) |
| Unknown payment method + signed + paid + card | Blocked: `billing_path_unknown` |

Additional scenario scripts (add as needed under `scripts/test/`):

- `scenario-selfpay-eligible-with-card.sql` ✅
- `scenario-medicaid-eligible-no-card.sql` ✅
- `scenario-unsigned-contract.sql` ✅
- `scenario-billing-path-unknown.sql` ✅

### Run all 5 matrix scenarios (SQL + API oracle)

```bash
./scripts/test/run-portal-readiness-matrix.sh
```

Uses default fixture Jordan (`1d981375-beeb-46e7-bf22-5d7a750eb391`) and admin `info@techluminateacademy.com`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `invalid input syntax for type uuid: "'your-uuid'"` | Placeholder `CLIENT_ID` and/or `-v client_id="'$CLIENT_ID'"` double-quoting | Use a real UUID; run `./scripts/test/run-portal-readiness-scenario.sh` |
| `Password for user app_user` prompt | `DB_PASSWORD` / `CLOUD_SQL_PASSWORD` not exported | `source .env` or use helper script |
| `address already in use` on 5433 | Proxy already running | Reuse it: `lsof -i :5433` — or `kill <pid>` then restart proxy |
| `zsh: command not found: #` | Pasted comment lines starting with `#` | Run commands one at a time; don't paste `#` comment lines into zsh |
| `ECONNRESET` on migrate | Stale/broken proxy | Restart proxy after `gcloud auth application-default login` |

---

```sql
SELECT contract_signed, deposit_paid, billing_path, is_eligible,
       portal_blockers, primary_portal_blocker, card_on_file,
       verification_invoice_id, eligibility_last_computed_at
FROM client_onboarding_readiness
WHERE client_id = :'client_id';

SELECT event_type, event_source, created_at
FROM client_onboarding_events
WHERE client_id = :'client_id'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Exit criteria (frontend alignment PR)

- [x] All 5 matrix scenarios match API oracle via `GET /api/clients/:id` (run `./scripts/test/run-portal-readiness-matrix.sh`)
- [ ] UI buttons follow `allowed_actions` only
- [ ] No duplicate eligibility logic in `portalStatus.ts` when `is_eligible` is present
- [ ] Missing-card and eligible states visually distinct on client detail
- [ ] One optional smoke: real verification invoice + portal invite in staging only

---

## Related

- Backend rules: `src/constants/portalEligibility.ts`
- Service: `src/services/portalEligibilityService.ts`
- Webhook: `POST /api/quickbooks/webhooks/invoice-paid`
- Unit tests: `src/__tests__/portalEligibility*.test.ts`
- **Playwright UI prompt:** `docs/PORTAL_READINESS_PLAYWRIGHT_PROMPT.md` (stubbed CRM tests for invite allowed/blocked + verification invoice visibility)
