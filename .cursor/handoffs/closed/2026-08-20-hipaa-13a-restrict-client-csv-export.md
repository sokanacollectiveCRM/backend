# Handoff: HIPAA-13A Restrict bulk client CSV exports

## Metadata

- Direction: `compliance->backend`
- Priority: `P0`
- Requested By: HIPAA remediation (INV-02)
- Date: `2026-08-20`
- Status: `ready_for_verification`
- Related Links:
  - `docs/HIPAA_13A_CLIENT_CSV_EXPORT_STATUS.md`
  - `docs/HIPAA_TECHNICAL_PHI_INVENTORY.md` (INV-02)
  - `docs/HIPAA_BOARD_TECHNICAL_STATUS.md`

## Why This Is Needed

`GET /clients/fetchCSV` allowed the `client` role and exported all families’
names, income, and address. Highest-clarity P0 authorization issue.

## Requested Changes

- [x] Remove `client` (and non-admin) role access — interim **admin-only**
- [x] Enforce server-side (route + use case)
- [x] Negative tests: client, doula, billing, unauthenticated
- [x] Log denied attempts without PHI
- [x] Stakeholder status of access + exported fields
- [ ] Production deploy confirmation
- [ ] Formal closure approval / reviewer sign-off

## Acceptance Criteria

- Non-admin roles receive 403; unauthenticated receives 401
- Admin still receives CSV
- Deny logs include role/userId/event only
- Stakeholder doc lists current export columns

## Completion Summary (2026-08-20)

Contained in code. Automated tests: `src/__tests__/clientCsvExportAuth.test.ts`
— **10/10 passed**. Stakeholder brief:
`docs/HIPAA_13A_CLIENT_CSV_EXPORT_STATUS.md`. Remaining: deploy + formal
closure.
