# Handoff: HIPAA-13F — Remove clinical information from intake emails

## Metadata

- Direction: `compliance->backend`
- Priority: `P0`
- Requested By: HIPAA board / INV-01
- Date: `2026-08-24`
- Status: `closed`
- Related Links:
  - `docs/HIPAA_13F_INTAKE_EMAIL_STATUS.md`
  - `docs/HIPAA_BOARD_TECHNICAL_STATUS.md` (INV-01)
  - `docs/EMAIL_NOTIFICATION_SYSTEM.md`

## Why This Is Needed

Public intake emailed the full clinical + identity payload to ordinary staff
Gmail (INV-01) — direct PHI exposure.

## Requested Changes

- Remove clinical fields from intake emails
- Keep PHI out of subject, body, URLs, and logs
- Send staff to authenticated CRM instead
- Add tests proving clinical fields are absent
- Document approved notification template

## Acceptance Criteria

- [x] Staff notification contains client number + CRM link only
- [x] Clinical / identity intake fields absent from staff subject/body
- [x] Submitter confirmation has no name/clinical content in subject/body
- [x] Unit + endpoint tests cover absence of clinical payload
- [x] Approved template documented (`docs/HIPAA_13F_INTAKE_EMAIL_STATUS.md`)

## Completion Summary

Implemented minimal intake notification builders under
`src/features/intake/notifications/`, wired through `requestFormController`,
propagated `client_number` on the intake entity, and updated email/HIPAA docs.
Pending production deploy and formal verification sign-off.
