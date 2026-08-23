# HIPAA-13E — Service Hours Write IDOR (INV-09)

**Ticket:** HIPAA-13E / INV-09 — Fix the service-hours IDOR  
**Priority:** P0 — Launch blocker  
**Status:** Ready for verification (code + automated tests complete; production deploy pending)

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
- [ ] Production deployment confirmation
- [ ] Reviewer sign-off

---

## Repository reference

| Item | Location |
| ---- | -------- |
| Route | `src/routes/specificUserRoutes.ts` — `POST /:id/addhours` |
| Controller | `src/controllers/userController.ts` — `addNewHours` |
| Assignment helper | `src/utils/sensitiveAccess.ts` — `canAccessSensitive` |
| Tests | `src/__tests__/addHoursAuthorization.test.ts` |
| Frontend consumer | `frontend-crm/src/common/utils/addWorkSession.ts` (unchanged; sends session doula id) |

---

## Automated test results

Run:

```bash
npm test -- addHoursAuthorization.test.ts
```

Expected: all tests pass (assigned doula, admin, unassigned doula, client, billing, inactive user, altered path/body ids, unassigned client, unauthenticated, deny audit log shape).

**Local run (2026-08-23):** 11/11 pass.

---

## Residual risk

- Legacy route remains (`POST /users/:id/addhours`); secure parallel exists at `POST /api/doulas/hours` (`doulaController.logHours`). Frontend still uses legacy path but is compatible with new guards.
- Admin hour entry is intentionally unscoped (explicit administrator authorization per ticket).
- Production verification pending post-deploy.

---

## Closure (pending deploy)

| Field | Value |
| ----- | ----- |
| PR / commit | _TBD at merge_ |
| Production revision | _TBD_ |
| Reviewer / date | _TBD_ |
| Formal approval | _Pending production verification_ |
