# HIPAA-13A — Client bulk CSV export status (stakeholder)

**Ticket:** HIPAA-13A / INV-02  
**Date:** 2026-08-20  
**Status:** **Contained in code** (admin-only). Pending production deploy + formal closure approval.

---

## What this feature is

CRM **Clients** toolbar → **Export** downloads a CSV of client demographic/financial fields via:

`GET /clients/fetchCSV`  
(also mounted at `/client/fetchCSV`, `/api/clients/fetchCSV`, `/api/client/fetchCSV`)

---

## Access control (after this change)

| Role | Can export? |
| ---- | ----------- |
| **admin** | Yes |
| client | **No** (403) |
| doula | **No** (403) |
| billing | **No** (403) — not approved yet |
| Unauthenticated | **No** (401) |

**Interim rule:** admin-only until leadership decides whether finance/development (or other) roles should export.

Enforced **server-side** (route middleware + use-case defense in depth). Frontend only hides the Export button for non-admins; that is not the security control.

---

## Fields currently exported (admin success path)

Source: `cloudSqlClientRepository.exportCSV` → **all columns** on every row in
`phi_clients` (`SELECT * … ORDER BY updated_at DESC`), currently **88 columns**
(as of 2026-08-20 Cloud SQL verify).

Includes identity, contact, address, intake, clinical/PHI notes, insurance /
billing, birth outcomes, portal/lifecycle, and QuickBooks sync fields.

Array columns (`services_interested`, `home_types`,
`birth_outcomes_medications_used`, etc.) are joined with `;` in the cell.

Nulls become empty cells. Values are RFC-style quoted CSV.

### Column inventory (Cloud SQL `phi_clients`, 2026-08-20)

`id`, `first_name`, `last_name`, `email`, `phone`, `date_of_birth`, `address_line1`, `due_date`, `health_history`, `allergies`, `medications`, `created_at`, `updated_at`, `client_id`, `health_notes`, `pregnancy_number`, `had_previous_pregnancies`, `previous_pregnancies_count`, `living_children_count`, `past_pregnancy_experience`, `baby_sex`, `baby_name`, `number_of_babies`, `race_ethnicity`, `client_age_range`, `annual_income`, `insurance`, `status`, `service_needed`, `portal_status`, `user_id`, `requested_at`, `invited_at`, `last_invite_sent_at`, `invite_sent_count`, `stripe_customer_id`, `qbo_customer_id`, `bio`, `city`, `state`, `zip_code`, `country`, `client_number`, `birth_outcomes`, `insurance_provider`, `insurance_member_id`, `policy_number`, `self_pay_card_info`, `payment_method`, `insurance_phone_number`, `has_secondary_insurance`, `secondary_insurance_provider`, `secondary_insurance_member_id`, `secondary_policy_number`, `birth_outcomes_induction`, `birth_outcomes_delivery_type`, `birth_outcomes_medications_used`, `matched_at`, `insurance_policy_holder_name`, `insurance_policy_holder_dob`, `insurance_policy_holder_relationship`, `insurance_plan_type`, `referral_source`, `referral_name`, `referral_email`, `referral_source_other`, `birth_location`, `birth_hospital`, `provider_type`, `pronouns`, `pronouns_other`, `preferred_contact_method`, `preferred_name`, `pets`, `service_support_details`, `services_interested`, `intake_age_years`, `primary_language`, `children_expected`, `home_access`, `home_types`, `home_type_other`, `home_adults_count`, `home_youth_count`, `quickbooks_sync_status`, `quickbooks_last_checked_at`, `quickbooks_last_synced_at`, `quickbooks_sync_error`

**Residual risk:** admins can bulk-download the full client row set (broad PHI).
Access remains **admin-only**; field narrowing is a product/compliance decision
if needed later.

---

## Evidence of change

| Item | Reference |
| ---- | --------- |
| Route allowlist | `src/routes/clientRoutes.ts` — `authorizeRoles(..., ['admin'])` |
| Use-case allowlist | `src/usecase/clientUseCase.ts` — throws if role ≠ admin |
| Policy constant | `CLIENT_CSV_EXPORT_ROLES` in `src/security/authorizationPolicies.ts` |
| Deny audit log | `authorizeRoles` logs `authorization_denied` with `userId`, `role`, `method`, `route`, `status` only (no CSV/PHI bodies) |
| Automated tests | `src/__tests__/clientCsvExportAuth.test.ts` |
| Auth matrix | `docs/ENDPOINT_AUTHORIZATION_MATRIX.md` |
| Frontend UX | Export button shown only when `user.role === 'admin'` |

---

## Closure checklist (ops / compliance)

- [x] Remove `client` role access (code)
- [x] Server-side enforcement
- [x] Negative tests (client / doula / billing / unauthenticated)
- [x] Denied attempts logged without PHI
- [x] Automated tests: `src/__tests__/clientCsvExportAuth.test.ts` — **10/10 passed** (2026-08-20)
- [ ] PR / commit link
- [ ] Production deployment confirmation
- [ ] Reviewer + review date
- [x] Residual risk acknowledged (admin exports **all** `phi_clients` columns for all rows)
- [ ] Formal closure approval

---

## Recommended next tickets

1. **HIPAA-07A** — Remove sensitive frontend logging  
2. **HIPAA-13B** — Enforce assignment checks for birth outcomes
