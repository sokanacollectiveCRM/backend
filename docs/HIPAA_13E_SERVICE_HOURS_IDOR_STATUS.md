# HIPAA-13E — Service Hours Write IDOR (INV-09)

**Ticket:** HIPAA-13E / INV-09 — Fix the service-hours IDOR  
**Priority:** P0 — Launch blocker  
**Status:** **Verified and closed** (2026-08-23). See
`docs/HIPAA_13E_VERIFICATION_SIGNOFF.md`.

---

## Finding

`POST /users/:id/addhours` allowed any authenticated user to write service hours for any client by trusting body `doula_id` and `client_id` without role or assignment checks.

---

## Remediation

| Layer | Change |
| ----- | ------ |
| Controller | `src/controllers/userController.ts` — `addNewHours` now enforces role (`admin` \| `doula`), approved account status, assignment via `canAccessSensitive` for doulas, and IDOR guards on path/body `doula_id` |
| Audit | Authorization denials logged via `backend-authz` / `authorization_denied` (user id + role only; no PHI) |
| Tests | `src/__tests__/addHoursAuthorization.test.ts` — negative matrix + success paths |

### Authorization rules

- **Doula:** Must be `account_status === 'approved'`; path `:id` and body `doula_id` must match session user; client must be actively assigned (`canAccessSensitive`).
- **Admin:** May log hours for any client; `doula_id` from body or path `:id`.
- **All other roles** (`client`, `billing`, etc.): 403 `FORBIDDEN`.
- **Unauthenticated:** 401 `UNAUTHENTICATED`.

---

## Definition of Done checklist

- [x] Hour entry restricted to assigned doula and authorized administrators
- [x] Assignment validated on server (`canAccessSensitive` → active `assignments` row)
- [x] Negative tests: unassigned doula, client, billing, inactive user, altered record IDs
- [x] Authorization audit logging retained (no PHI in deny logs)
- [x] Production deployment confirmation (`sokana-private-api-00040-n2d` @ `66332ab`)
- [x] Reviewer sign-off (`docs/HIPAA_13E_VERIFICATION_SIGNOFF.md`, Jerry Bony, 2026-08-23)

---

## Repository reference

| Item | Location |
| ---- | -------- |
| Route | `src/routes/specificUserRoutes.ts` — `POST /:id/addhours` |
| Controller | `src/controllers/userController.ts` — `addNewHours` |
| Assignment helper | `src/utils/sensitiveAccess.ts` — `canAccessSensitive` |
| Tests | `src/__tests__/addHoursAuthorization.test.ts` |
| Prod verify script | `scripts/verify-hipaa13e-addhours-prod.ts` |
| Frontend consumer | `frontend-crm/src/common/utils/addWorkSession.ts` (unchanged; sends session doula id) |

---

## Automated test results

```bash
npm test -- addHoursAuthorization.test.ts
```

**Local run (2026-08-23):** 11/11 pass.  
**Full suite (2026-08-23):** 51 suites / 413 tests pass.

---

## Residual risk

- Legacy route remains (`POST /users/:id/addhours`); secure parallel exists at `POST /api/doulas/hours` (`doulaController.logHours`). Frontend still uses legacy path but is compatible with new guards.
- Admin hour entry is intentionally unscoped (explicit administrator authorization per ticket).

---

## Closure

| Field | Value |
| ----- | ----- |
| PR / commit | [PR #80](https://github.com/sokanacollectiveCRM/backend/pull/80) / `66332ab` |
| Production revision | `sokana-private-api-00040-n2d` |
| Image | `backend-repo/api:66332ab62b5fcbb3eec460cf7cb9dbd3038102e0` |
| Cloud Build | SUCCESS `2026-08-23T19:57:11Z` |
| Reviewer / date | Jerry Bony / 2026-08-23 |
| Formal approval | **Verified — closed** |
