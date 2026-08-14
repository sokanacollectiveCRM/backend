# Pilot-critical backend journeys and rollback expectations

**Owner context:** architecture handoff PR 2 (baseline + CI)  
**Deployable:** Cloud Run service `sokana-private-api` (unchanged single
service)

## Test baseline (recorded 2026-08-11)

| Metric       | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Suites       | 38 (pre smoke) → 39 with security-smoke scaffold         |
| Tests        | 300 minimum gate; **303 passing** after PR 2 smoke tests |
| Command      | `npm test -- --runInBand`                                |
| Build        | `npm run build` (`tsc && tsc-alias`)                     |
| Node         | `20.x` (`package.json` `engines`)                        |
| Open handles | Must not require `--forceExit`; Jest must exit normally  |

Security smoke (bounded, expandable for auth-matrix work):

```bash
npm run test:security-smoke
```

## Pilot-critical journeys

Treat these as must-not-break during P0/P1 refactors.
Characterization/regression coverage should prefer these paths.

1. **Health** — `GET /health` returns 200 without DB/vendor calls.
2. **Auth session** — login (`POST /login` or `/auth/login`) sets cookie;
   `GET /auth/me` returns user/role; logout clears cookie.
3. **Public request intake** — `POST /requestService/requestSubmission` accepts
   CRM payload and returns the frozen success message (or documented 400
   validation).
4. **Client CRM read/update** — list/detail/update under `/clients` (+ aliases)
   for admin/doula; status updates for pipeline.
5. **Doula dashboard** — clients, hours, activities, documents, profile under
   `/api/doulas/*` with existing `{ success, … }` wrappers.
6. **Admin matching / portal invite** — `/api/admin/clients/matching`, match
   assignment, portal invite/resend/disable.
7. **Contracts templates** — `GET /contracts/templates` (and
   `/api/contracts/templates`) for admin; no-store caching behavior.
8. **Signing / SignNow callback** — contract send paths used in pilot +
   `POST /api/signnow/callback` acknowledgement.
9. **Billing / payments / invoices** — admin billing contract list/detail;
   payment and invoice list endpoints used by CRM.
10. **QuickBooks (when feature enabled)** — status/connect, customer/invoice
    helpers, payment-method status, invoice-paid webhook acknowledgement.

Companion frontend journeys (coordinate only; do not break BE compatibility
first): auth cookie transport, Customers/QB empty states, Contracts templates
panel, doula dashboard tabs, portal password/set flows.

## Rollback expectations

| Concern            | Expectation                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud Run revision | Keep previous `sokana-private-api` revision ready; traffic shift only after smoke.                                                                |
| DB migrations      | Never auto-run at boot. Prefer additive/forward-compatible migrations; deploy BE compatibility before FE.                                         |
| API contracts      | Prefer dual-support over breaking field/status changes. Document any intentional break in the handoff.                                            |
| Auth transport     | Dual-support cookies/headers/tokens before retiring legacy delivery.                                                                              |
| Feature flags      | `FEATURE_QUICKBOOKS` and debug endpoint gates must not change meaning without notice.                                                             |
| CI gate failure    | Do not deploy from a commit that failed GitHub Actions `Backend Test Gate` or Cloud Build `test-gate` (install + build + tests + security smoke). |
| Rollback owner     | On-call / engineer who shipped the revision: restore prior Cloud Run revision; revert FE only if it already depended on a new BE contract.        |
| Health check       | Do not change lightweight `/health` semantics during rollback validation.                                                                         |

## Explicit non-goals for this baseline PR

- No security hardening of unauthenticated routes (tracked in later PRs).
- No feature-folder moves or import rewires.
- No Cloud Run multi-service split.
- No production deploys from this documentation/CI work alone.
