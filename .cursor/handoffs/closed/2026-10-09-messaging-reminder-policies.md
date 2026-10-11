# Handoff: Admin-configurable messaging reminder policies (backend v4)

## Metadata

- Direction: `backend`
- Priority: `P0`
- Requested By: Jerry Bony
- Date: `2026-10-09`
- Status: `closed`
- Related Links:
  - uploads backend coding prompt v4
  - `docs/MESSAGING_API.md`

## Why This Is Needed

Admins need editable reminder policies (signing day 3 / day 7, postponement
auto-restart, birth outcomes, overdue notes) with a kill switch, dedupe, and an
OIDC tick. Pilot first on the dev Cloud Run service.

## Requested Changes

- [x] Migrations + seeds (no deposit policy)
- [x] Engine, tick, postponements, per-contract stop
- [x] Admin / doula / internal HTTP APIs
- [x] Jest coverage for the v4 cases
- [x] One PR against `main`, not merged

## Completion summary

Backend messaging engine shipped on branch
`cursor/messaging-reminder-policies-f041` (PR
https://github.com/sokanacollectiveCRM/backend/pull/96 vs `main`, not merged).
Deploy the PR build to the **dev** Cloud Run API, run
`src/db/migrations/20261009_messaging_reminder_policies.sql`, set the reminder
env vars, then create Cloud Scheduler. Catalog: `docs/MESSAGING_API.md`. Tick:
`POST /api/internal/cron/reminders/tick`.
