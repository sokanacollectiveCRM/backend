# Handoff: Public intake CORS Idempotency-Key + Nancy required fields

## Metadata

- Direction: `frontend->backend`
- Priority: `P0`
- Requested By: Nancy Cowans / Sokana Collective (dev pilot, starts Monday Oct
  12, 2026)
- Date: `2026-10-09`
- Status: `closed`
- Backend PR: https://github.com/sokanacollectiveCRM/backend/pull/98 (draft, do
  **not** merge; deploy to **dev** Cloud Run API first)
- Related Links:
  - Frontend PR: https://github.com/sokanacollectiveCRM/frontend/pull/103
  - Dev frontend: `https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app`
  - Dev API: `https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app`

## Completion summary (2026-10-09)

- CORS `allowedHeaders` includes `Idempotency-Key`. Origin allowlist unchanged.
  Intake already honors optional `Idempotency-Key` replay.
- Public intake required fields match Nancy (2026-10-09): first/last name,
  email, phone, city, zip, due date, service requested, why-doula
  (`service_support_details`), plus `primary_language_other` only when language
  is Other. Address/state, age, provider, home counts, birth place, payment,
  insurance details, referral, and pronouns are optional.
- Persist `primary_language_other`. Derive optional `client_age_range` from
  exact age when omitted.
- Migration (not run at boot):
  `npm run migrate:cloudsql -- src/db/migrations/20261009_phi_clients_primary_language_other.sql`
- GitHub checks on PR #98: **green** (Backend Test Gate + Lint and Format
  Check). Second commit applied pre-existing `main` tsc errors
  (`AuthRequest.tenant`, `attachDisplayProfilePicture`) so this PR typechecks
  independently of messaging PR #97.

## Requested Changes

- [x] Add `Idempotency-Key` to CORS `allowedHeaders`.
- [x] Relax public-intake required validation to Nancy's 2026-10-09 set.
- [x] Accept and persist `primary_language_other`.
- [x] Derive or accept optional `client_age_range`.
- [x] Keep intake Idempotency-Key replay working.

## Acceptance Criteria

- [x] OPTIONS preflight from the dev frontend origin with
      `Access-Control-Request-Headers: content-type,idempotency-key` returns
      `Access-Control-Allow-Headers` containing `Idempotency-Key`.
- [x] Minimal Nancy payload validates and inserts.
- [x] Missing required fields return 400 naming the fields.

## Implementation Notes

- CORS origin allowlist is already correct; do not change it.
- Do not merge to prod; deploy to the **dev** Cloud Run API first.
