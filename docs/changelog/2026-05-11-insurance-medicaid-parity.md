# Ops changelog: Insurance (Medicaid parity) — 2026-05-11

## Database (Cloud SQL `public.phi_clients`)

Apply migration:

`src/db/migrations/add_phi_clients_expanded_primary_insurance.sql`

New nullable columns:

- `insurance_policy_holder_name` (text)
- `insurance_policy_holder_dob` (date)
- `insurance_policy_holder_relationship` (text)
- `insurance_plan_type` (text)

`policy_number` remains nullable; it is treated as **group number** and is **optional** for Commercial, Private, and Medicaid.

## API behavior

- **Intake:** `POST /requestService/requestSubmission` (`RequestFormService.newForm`) requires, when payment is not Self-Pay: policy holder name/DOB/relationship, plan type, provider, member ID. `policy_number` optional. Same enum validation as billing.
- **Billing:** `GET`/`PUT` `/api/clients/:id/billing` and `/api/clients/me/billing` — same rules; responses include the new fields (snake_case plus camelCase aliases on billing GET payloads for portal compatibility).
- **Client detail** (authorized PHI paths): merged profile responses include the new fields from `phi_clients` via the existing `User`/Cloud SQL read path.

## Rollout

1. Run the migration on `sokana_private` before deploying the backend that writes the new columns.
2. Deploy backend. Older rows return `null` for the new fields until updated in portal/CRM.

## Secondary insurance

Unchanged: when `has_secondary_insurance` is true, secondary provider, member ID, and `secondary_policy_number` remain required.
