# Playwright Prompt — Portal Eligibility UI (`allowed_actions` vs blocked)

Copy everything below the line into Cursor (frontend-crm repo) or hand to an agent implementing E2E tests.

---

## Agent task

Implement Playwright E2E tests that prove the **CRM Clients UI** respects backend portal readiness — specifically **invite allowed vs blocked** and **verification invoice action visibility** — without requiring QuickBooks, webhooks, or real portal invite emails.

This validates the same 5-scenario matrix already proven on the backend API (`./scripts/test/run-portal-readiness-matrix.sh` in the **backend** repo). The UI must follow backend fields (`is_eligible`, `primary_portal_blocker`, `allowed_actions`), not legacy client-side contract/payment guessing.

---

## Repo & conventions

| Item | Value |
|------|--------|
| Frontend repo | `/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm` |
| Playwright config | `playwright.config.ts` (dev server `http://localhost:3001`) |
| Existing E2E pattern | `e2e/clients-leads-customers-tabs.spec.ts` + `e2e/fixtures/httpStubs.ts` |
| Target route | `/clients` → **Customers** tab (fixture client is `status: 'matched'`) |
| Auth stub | `stubAuthMe(page, { role: 'admin', ... })` — no real Supabase login needed for stubbed tests |

**Prefer stubbed API responses** (`page.route('**/clients', ...)`) so tests run in CI without Cloud SQL, backend, or QBO.

Optional follow-up spec (separate file, `@live` tag or `test.describe.configure({ mode: 'serial' })`): integration against local backend + Jordan fixture — document but do not block CI on it.

---

## UI surfaces to assert

### 1) Clients table — Portal column (`users-columns.tsx`)

| Backend state | Portal column UI |
|---------------|------------------|
| `is_eligible: true`, `portal_status: 'not_invited'` | Badge **Eligible** + enabled **Invite** button |
| `is_eligible: false`, `primary_portal_blocker: 'missing_card_on_file'` | Badge **Missing card on file** (or blocker label) + **no** Invite button |
| `is_eligible: false`, `primary_portal_blocker: 'contract_unsigned'` | Badge **Contract unsigned** (or blocker label) + **no** Invite button |
| `is_eligible: false`, `primary_portal_blocker: 'billing_path_unknown'` | Badge **Billing path unknown** + **no** Invite button |

Tooltip on blocked rows should show human-readable blocker description from `getPortalBlockerDescription()`.

### 2) Row actions menu (`data-table-row-actions.tsx`)

- **Invite to portal** menu item: `disabled` when not eligible; `title` attribute contains blocker reason when disabled.
- Do **not** click through to send a real invite in stubbed tests — only assert enabled/disabled state.

### 3) Client detail / profile modal (`LeadProfileModal.tsx`)

On the onboarding/readiness section:

| Backend state | Detail UI |
|---------------|-----------|
| `is_eligible: true` | **Portal eligibility** → `Eligible` |
| `is_eligible: false` | **Portal eligibility** → `Locked` + **Primary blocker** label |
| `allowed_actions.can_send_verification_invoice: true` | Button **Send $1 verification invoice** visible and enabled |
| `allowed_actions.can_send_verification_invoice: false` | That button **not visible** (or disabled) |

**Do not click** “Send $1 verification invoice” in default stubbed tests (that hits QBO). Stub `POST **/billing/send-verification-invoice` only if testing click behavior in a dedicated test.

---

## Fixture client (use in all stub payloads)

```json
{
  "id": "1d981375-beeb-46e7-bf22-5d7a750eb391",
  "first_name": "Jordan",
  "last_name": "Bony",
  "email": "jbony@icstars.org",
  "status": "matched",
  "portal_status": "not_invited",
  "payment_method": "Medicaid",
  "qbo_customer_id": "90",
  "service_needed": "Labor Support",
  "requested_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

Merge readiness fields per scenario below into this object inside `GET **/clients` list response (`success: true, data: [...]`).

---

## Five matrix scenarios → stub payloads → UI expectations

Use these exact readiness shapes (match backend oracle from `run-portal-readiness-matrix.sh`).

### Scenario 1 — Self-Pay, no card (invite blocked, verification allowed)

```json
{
  "billing_path": "self_pay",
  "is_eligible": false,
  "portal_blockers": ["missing_card_on_file"],
  "primary_portal_blocker": "missing_card_on_file",
  "payment_authorization_required": true,
  "payment_authorization_satisfied": false,
  "card_on_file": false,
  "contract_signed": true,
  "deposit_paid": true,
  "allowed_actions": {
    "can_invite_to_portal": false,
    "can_send_verification_invoice": true,
    "can_mark_contract_signed": false,
    "can_mark_deposit_paid": false
  }
}
```

**Assert:** no Invite button; blocker mentions missing card; row action “Invite to portal” disabled; on detail modal, “Send $1 verification invoice” **visible**.

### Scenario 2 — Self-Pay + card (eligible)

```json
{
  "billing_path": "self_pay",
  "is_eligible": true,
  "portal_blockers": [],
  "primary_portal_blocker": null,
  "card_on_file": true,
  "allowed_actions": {
    "can_invite_to_portal": true,
    "can_send_verification_invoice": false,
    "can_mark_contract_signed": false,
    "can_mark_deposit_paid": false
  }
}
```

**Assert:** **Eligible** badge + enabled **Invite** button; verification invoice button **hidden**.

### Scenario 3 — Medicaid, no card (eligible)

```json
{
  "billing_path": "medicaid",
  "is_eligible": true,
  "portal_blockers": [],
  "primary_portal_blocker": null,
  "card_on_file": false,
  "allowed_actions": {
    "can_invite_to_portal": true,
    "can_send_verification_invoice": false,
    "can_mark_contract_signed": false,
    "can_mark_deposit_paid": false
  }
}
```

**Assert:** same as scenario 2 (eligible, invite on, no verification button).

### Scenario 4 — Unsigned + unpaid (contract blocker)

```json
{
  "billing_path": "self_pay",
  "is_eligible": false,
  "portal_blockers": ["contract_unsigned", "deposit_unpaid", "missing_card_on_file"],
  "primary_portal_blocker": "contract_unsigned",
  "card_on_file": false,
  "contract_signed": false,
  "deposit_paid": false,
  "allowed_actions": {
    "can_invite_to_portal": false,
    "can_send_verification_invoice": false,
    "can_mark_contract_signed": true,
    "can_mark_deposit_paid": false
  }
}
```

**Assert:** blocker **Contract unsigned**; invite disabled; verification invoice **hidden**.

### Scenario 5 — Unknown billing path (blocked even with card)

```json
{
  "billing_path": "unknown",
  "is_eligible": false,
  "portal_blockers": ["billing_path_unknown"],
  "primary_portal_blocker": "billing_path_unknown",
  "card_on_file": true,
  "contract_signed": true,
  "deposit_paid": true,
  "allowed_actions": {
    "can_invite_to_portal": false,
    "can_send_verification_invoice": false,
    "can_mark_contract_signed": false,
    "can_mark_deposit_paid": false
  }
}
```

**Assert:** **Billing path unknown**; invite disabled; verification invoice hidden.

---

## Implementation requirements

1. **New file:** `e2e/portal-eligibility-actions.spec.ts`
2. **Helper:** `e2e/helpers/portalEligibilityStubs.ts` with:
   - `buildJordanClient(overrides)` — base fixture + readiness merge
   - `stubClientsList(page, clients, corsHeaders?)`
   - `stubClientDetail(page, client, corsHeaders?)` for modal tests (`GET **/clients/:id` or whatever the app calls on row click)
3. **Shared setup** per test:
   - `installCorsPreflightStub`
   - `stubAuthMe` as admin
   - route `GET **/clients` with single Jordan row + scenario readiness fields
4. **Navigation:**
   - `page.goto('/clients')`
   - click **Customers** tab
   - expect `Jordan Bony` visible
5. **Selectors** (prefer role/text; add `data-testid` only if flaky):
   - Invite: `getByRole('button', { name: 'Invite' })`
   - Blocker badge: `getByText(/Missing card on file|Contract unsigned|Billing path unknown/i)`
   - Row menu: `getByRole('button', { name: /Open menu/i })` → `getByRole('menuitem', { name: /Invite to portal/i })`
   - Detail: click row → modal → `getByText('Portal eligibility')` sibling/assert locked/eligible
   - Verification: `getByRole('button', { name: /Send \$1 verification invoice/i })`
6. **Negative assertions:** use `.toHaveCount(0)` or `expect(...).toBeDisabled()` — do not rely on opacity alone.
7. **npm script:** add `"test:portal-eligibility:e2e": "playwright test e2e/portal-eligibility-actions.spec.ts"` to `package.json`.
8. **Do not** require QuickBooks, Cloud SQL proxy, or backend for the default stubbed suite.

---

## Optional live integration spec (manual / nightly only)

File: `e2e/portal-eligibility-live.spec.ts` (skip in CI via `test.skip(!process.env.PORTAL_E2E_LIVE)`)

**Prerequisites:**
- Backend `npm run dev` on `:5050`
- Cloud SQL proxy
- Run backend matrix scenario before each case:
  ```bash
  cd backend && ./scripts/test/run-portal-readiness-scenario.sh selfpay-missing-card
  ```
- Login storage: `info@techluminateacademy.com` via `storageState` (see `e2e/portfolio/auth.setup.ts` pattern)
- Frontend `VITE_APP_BACKEND_URL=http://localhost:5050`

**Flow:** real login → Customers tab → find Jordan → assert UI matches API (compare Network tab `GET /api/clients` response to visible badges/buttons).

---

## Acceptance criteria

- [ ] All 5 stubbed scenarios pass in `portal-eligibility-actions.spec.ts`
- [ ] Tests fail if UI uses legacy eligibility (e.g. invite enabled when `is_eligible: false` without override)
- [ ] Verification invoice button only appears for scenario 1
- [ ] Invite button only enabled for scenarios 2 and 3
- [ ] No real portal invite or QBO calls in default test run
- [ ] `npm run test:portal-eligibility:e2e` documented in spec header comment

---

## Reference (backend)

- API oracle script: `backend/scripts/test/run-portal-readiness-matrix.sh`
- Test plan: `backend/docs/PORTAL_READINESS_TEST_PLAN.md`
- Frontend logic: `frontend-crm/src/lib/portalEligibility.ts` (`canInviteToPortal`, `shouldShowVerificationInvoiceAction`)
- Blocker labels: `contract_unsigned`, `deposit_unpaid`, `missing_card_on_file`, `billing_path_unknown`

---

## Example test skeleton

```typescript
import { test, expect } from '@playwright/test';
import { installCorsPreflightStub, stubAuthMe, defaultCorsHeaders } from './fixtures/httpStubs';
import { stubClientsList, buildJordanClient, SCENARIOS } from './helpers/portalEligibilityStubs';

test.describe('Portal eligibility — invite & verification actions', () => {
  test('Self-Pay missing card: invite blocked, verification visible', async ({ page }) => {
    const headers = defaultCorsHeaders();
    await installCorsPreflightStub(page, headers);
    await stubAuthMe(page, { id: 'admin-1', firstname: 'Admin', lastname: 'User', email: 'info@techluminateacademy.com', role: 'admin' }, headers);
    await stubClientsList(page, [buildJordanClient(SCENARIOS.selfPayMissingCard)], headers);

    await page.goto('/clients');
    await page.getByRole('tab', { name: /Customers/i }).click();
    await expect(page.getByText('Jordan Bony')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite' })).toHaveCount(0);
    await expect(page.getByText(/Missing card on file/i)).toBeVisible();
    // Open profile modal and assert verification CTA...
  });

  // ... scenarios 2–5
});
```

Implement the helper + full spec; run until green.
