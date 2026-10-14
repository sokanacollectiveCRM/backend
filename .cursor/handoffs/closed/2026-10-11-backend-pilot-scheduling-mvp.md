# Handoff: Pilot scheduling MVP (backend)

## Metadata

- Direction: `user->backend`
- Priority: `P0` (pilot Mon Oct 12, 2026 16:00 BRT)
- Requested By: Jerry Bony
- Date: `2026-10-11`
- Status: `closed`
- Related Links:
  - `docs/SCHEDULING_MVP.md`
  - Branch `cursor/pilot-scheduling-mvp-backend-c17a`
  - Integration branch `pilot/backend-dev-20261012`

## Why This Is Needed

Pilot session needs doula/client visit booking on dev. Backend tables and
availability CRUD already exist; listing, approve/decline/cancel, open slots,
overlap checks, and emails did not.

## Requested Changes

- New `/api/scheduling` package with the locked API contract
- Env `BOOKING_REQUIRE_CONTRACT_STAGE` default `true`
- 60-minute visits
- Doula + admin approve/decline/cancel; client cancel own
- PHI-minimized emails via `emailService.sendEmail`
- Guarded fixture seed for Jerry's plus-addresses
- PR against `main` (do not merge)
- Integration branch `pilot/backend-dev-20261012` = main + PR #98 + this branch

## Acceptance Criteria

- [x] Endpoints match section 5 paths/params/payloads/status codes
- [x] Jest + build pass (103 suites / 732 tests; `npm run build` green)
- [x] Docs + seed script
- [x] PR open against main, not merged
- [x] Integration branch created without #96/#97

## Completion Summary

Implemented `src/features/scheduling/` mounted at `/api/scheduling`. Contract:
`docs/SCHEDULING_MVP.md`. Fixture: `scripts/dev-env/seed-scheduling-fixture.ts`
(dev-only guard). Emails: PHI-minimized builders; notes never logged or mailed.
Integration test applied `add_doula_availability_and_scheduling_cloudsql.sql`
against local Postgres and confirmed overlap 409.
