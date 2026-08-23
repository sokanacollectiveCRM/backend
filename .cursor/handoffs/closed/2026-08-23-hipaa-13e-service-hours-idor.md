# Handoff — HIPAA-13E Service Hours IDOR

- Direction: `backend->compliance`
- Priority: `P0`
- Requested By: HIPAA remediation (INV-09)
- Date: `2026-08-23`
- Status: `closed`
- Related Links:
  - `docs/HIPAA_13E_SERVICE_HOURS_IDOR_STATUS.md`
  - `docs/HIPAA_13E_VERIFICATION_SIGNOFF.md`
  - PR #80 — https://github.com/sokanacollectiveCRM/backend/pull/80

## Problem

`POST /users/:id/addhours` allowed any logged-in user to write service hours for
any client (session-only auth; trusted body `doula_id` / `client_id`).

## Requested Changes

- [x] Restrict hour entry to assigned doula + authorized administrators
- [x] Validate assignment on the server
- [x] Negative tests: unassigned doula, client, billing, inactive user, altered IDs
- [x] Retain authorization evidence (deny audit logs without PHI)
- [x] Production deploy confirmation
- [x] Formal closure / reviewer sign-off

## Acceptance Criteria

Hour writes fail closed for unauthorized roles and unassigned doulas; admins and
assigned approved doulas can still log hours; evidence retained for audit.

## Completion Summary

Implemented in `userController.addNewHours` using `canAccessSensitive` + IDOR
guards. Automated tests: `src/__tests__/addHoursAuthorization.test.ts` —
**11/11 passed**. Full suite **413/413 passed**. Merged PR #80 (`66332ab`);
production revision `sokana-private-api-00040-n2d`. Formal sign-off:
`docs/HIPAA_13E_VERIFICATION_SIGNOFF.md` (Jerry Bony, 2026-08-23).
