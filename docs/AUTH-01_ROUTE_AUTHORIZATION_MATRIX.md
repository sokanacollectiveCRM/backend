# AUTH-01A — Route and Authorization Matrix

Status: Draft inventory (2026-07-19). This document records current behavior; it does not authorize or implement route changes.

## Enforcement model observed

- `authMiddleware` accepts an X-Session-Token, Bearer token, or `sb-access-token` cookie, validates it with Supabase, then loads the application user.
- `authorizeRoles` trusts the role on that loaded application user and checks membership in a route-specific list.
- Authentication and role checks do not inherently enforce resource ownership, client-to-doula assignment, or suspended-account status.
- Public callbacks must use provider signature verification rather than user authentication. That exception must be explicit and tested.

## Mounted route matrix

| Mounted prefix | Router | Current protection | Intended policy | AUTH-01 disposition |
|---|---|---|---|---|
| `/login` | direct auth controller | Public | Public authentication endpoint | Keep public; rate/abuse controls are separate |
| `/auth` | `authRoutes` | Mixed; `/users` alone has auth | Auth lifecycle endpoints public where necessary; `/me`, logout and password mutation require a valid subject; user listing admin-only | AUTH-01D/E |
| `/api` | `doulas` | Auth + mostly admin roles | Administrative assignment endpoints | Verify all role mappings in AUTH-01C/D |
| `/api/admin` | `adminRoutes` | Router-wide auth + admin per route | Admin only | Negative tests in AUTH-01E |
| `/api/doulas` | `doulaRoutes` | Auth + route roles | Doula self-service or admin; assigned-client access only | AUTH-01C/E |
| `/email` | `EmailRoutes` | Router-wide auth, no role restriction | Explicit authorized sender roles | AUTH-01D/E |
| `/requestService` | `requestRoute` | Public submission | Public intake only | Keep public; abuse controls separate |
| `/clients`, `/client`, `/api/clients`, `/api/client` | `clientRoutes` | Auth + route roles | Admin, client owner, or assigned doula depending on resource | AUTH-01C/E |
| `/quickbooks`, `/api/quickbooks` | `quickbooksRoutes` | OAuth start/callback public; remainder authenticated without role restriction | Callback public with state validation; management/admin-billing only; webhook separately authenticated | AUTH-01B/D/E |
| `/quickbooks/customers` | `customersRoutes` | Public | Admin/billing only | AUTH-01B critical |
| payment-method aliases | `paymentMethodRoutes` | Router-wide auth + broad roles | Client owner or authorized staff | AUTH-01C/E |
| `/users` | `specificUserRoutes` | Authenticated, no ownership/role checks at router | Self, assigned operational need, or admin | AUTH-01C/E critical |
| `/api/contract` | `contractRoutes` | Public | Admin/authorized staff; client access only to owned contract actions | AUTH-01B critical |
| `/api/contract-signing` | `contractSigningRoutes` | Public | Admin/authorized staff; provider callback handled separately | AUTH-01B critical |
| `/api/pdf-contract` | `pdfContractRoutes` | Public | Admin/authorized staff; test endpoints non-production only | AUTH-01B critical |
| `/api/payments` | `paymentRoutes` | Mixed; only list/history protected | Admin/billing for aggregate/mutation; owner/assignment checks for contract data | AUTH-01B/C critical |
| `/api/invoices` | `invoiceRoutes` | Auth + admin/doula | Admin/billing, with deliberate doula scope if required | AUTH-01D/E |
| `/api/financial` | `financialRoutes` | Auth + admin/doula | Admin/billing; validate any doula business need | AUTH-01D/E |
| `/api/billing` | `billingRoutes` | Auth + admin/billing | Admin/billing | Negative tests in AUTH-01E |
| `/api/signnow` | `signNowRoutes` | Public | Provider callback public with verification; all operational/debug actions authorized | AUTH-01B critical |
| `/api/dashboard` | `dashboardRoutes` | Auth + admin on observed routes | Admin only | Negative tests in AUTH-01E |
| `/debug` | `debugRoutes` | Non-production mount + auth | Non-production only | Preserve environment gate |

## Critical public routes for AUTH-01B

| Route | Current risk | Required control |
|---|---|---|
| `POST /api/contract/postpartum/calculate` | Public contract/business calculation | Auth + explicit staff role unless product owner documents public need |
| `POST /api/contract/postpartum/send-client-invite` | Public SignNow invitation creation | Auth + staff role + client/contract validation |
| `GET /api/contract-signing/test-auth` | Public provider-account probe | Admin and non-production only |
| `POST /api/contract-signing/generate-and-send` | Public contract creation and delivery | Auth + staff role + target-client authorization |
| `POST /api/contract-signing/get-field-coordinates` | Public provider document access | Admin only and non-production if diagnostic |
| `POST /api/contract-signing/generate-contract` | Public contract/payment workflow | Auth + staff role + target-client authorization |
| `GET /api/contract-signing/status/:documentId` | Public document enumeration/status | Auth + document ownership/assignment |
| `POST /api/pdf-contract/process` | Public provider action; source contains a hard-coded SignNow token | Disable immediately pending secret remediation; never use source token |
| `GET/POST /api/pdf-contract/templates`, `/validate` | Public internal template metadata/validation | Auth + staff role |
| `POST /api/pdf-contract/test` | Public test workflow invoking provider | Non-production + admin, or remove from mounted router |
| SignNow test/template/debug routes | Public provider probes and document operations | Non-production + admin |
| `POST /api/signnow/send-client-partner` | Public invitation creation | Auth + staff role + client/contract validation |
| `POST /api/signnow/callback` | Public webhook | Keep public only with verified provider authenticity and replay protection |
| Payment dashboard/overdue/status/due-between | Public financial data | Auth + admin/billing |
| Contract payment summary/schedule | Public client-linked financial data | Auth + owner/assignment/admin-billing checks |
| Payment status and maintenance mutations | Public financial mutation | Admin/billing; scheduled jobs require service authentication |
| `/quickbooks/customers/*` | Public QuickBooks customer operations through separately mounted router | Auth + admin/billing |

## Ownership and assignment gaps for AUTH-01C

- `/users/:id`, `/users/:id/hours`, and hour mutations authenticate but do not enforce self/admin/assignment ownership at the router.
- Client routes frequently authorize a role without proving that a client subject owns the requested client ID or that a doula is actively assigned to it.
- Payment history applies a client filter, but the other contract payment endpoints do not.
- SignNow document IDs and contract IDs require server-side association with an authorized client, assigned doula, or staff role; possession of an identifier is not authorization.
- QuickBooks, billing, invoice, and aggregate financial access should not be granted merely because a user is an authenticated doula.

## Role and account-state gaps for AUTH-01D

- Confirm the application role is loaded from the canonical server-side database record, not mutable Supabase user metadata or request input.
- Define and enforce suspended/disabled/deactivated account handling in `authMiddleware` before `next()`.
- Make admin, billing, doula, and client role capabilities explicit and deny unknown roles.
- Protect `/auth/users` with admin authorization; authentication alone is insufficient.

## Required negative tests for AUTH-01E

- Unauthenticated requests receive 401 on every protected route.
- Authenticated users with the wrong role receive 403.
- Clients cannot read or mutate another client's resources by changing path/body IDs.
- Doulas cannot access unassigned clients, including historical or removed assignments.
- Suspended users cannot access otherwise authorized routes.
- Unknown or client-controlled role claims do not elevate privileges.
- Webhook callbacks reject missing, invalid, expired, and replayed signatures.
- Maintenance/provider test routes reject production access and non-admin callers.

## Sequencing decision

AUTH-01B should first protect or disable public provider, contract, QuickBooks-customer, and payment routes without changing their business logic. AUTH-01C then adds resource-level ownership/assignment checks, followed by canonical role and account-state enforcement in AUTH-01D and comprehensive negative tests in AUTH-01E.
