# HIPAA-13B — Doula Client/Family Read Assignment Gates

**Tickets:** HIPAA-13B / INV-03 / INV-13  
**Finding:** Authenticated doulas could read client/family operational data
(name, email, phone, address, status) via `GET /clients/:id` even when not
assigned. Related CRM activity routes lacked the assignment checks already
present on `/api/doulas/clients/:clientId`.

---

## Endpoints reviewed

| Method    | Route                                      | Role gate (route)    | Assignment check (before)                                | Deny response     |
| --------- | ------------------------------------------ | -------------------- | -------------------------------------------------------- | ----------------- |
| GET       | `/clients`                                 | admin, doula         | List scoped via `getClientsLite` / Cloud SQL assign join | N/A (list only)   |
| GET       | `/clients/:id`                             | admin, doula, client | **Added** `ensureStaffClientAccess` (doula, read)        | 404 (no DB read)  |
| GET       | `/clients/:id/activities`                  | admin, doula, client | **Added** (doula, read)                                  | 404               |
| POST      | `/clients/:id/activity`                    | admin, doula         | **Added** (doula, write)                                 | 403               |
| GET       | `/clients/:id/documents`                   | admin, doula         | **Updated** document auth helper                         | 404               |
| GET       | `/clients/:id/documents/:documentId/url`   | admin, doula         | same                                                     | 404               |
| GET       | `/clients/:id/assigned-doulas`             | admin, doula, client | **Added** (doula, read)                                  | 404               |
| PUT       | `/clients/status`                          | admin, doula         | **Added** (doula, write)                                 | 403               |
| PUT/PATCH | `/clients/:id`                             | admin, doula, client | **Added** (doula, write)                                 | 403               |
| GET       | `/api/doulas/clients/:clientId`            | doula                | Existing Cloud SQL assign join                           | **404** (was 403) |
| GET       | `/api/doulas/clients/:clientId/activities` | doula                | Existing assign join                                     | **404** (was 403) |

Admin routes unchanged. Client self-access unchanged (`role === 'client'`
resolves own profile id first).

---

## Code changes

| Area                                                | Change                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/controllers/clientController.ts`               | `ensureStaffClientAccess()` helper; assignment gates on read/write handlers; unassigned doula reads return **404 without client row lookup** |
| `src/controllers/doulaController.ts`                | Dashboard client detail + activities reads return 404 when unassigned                                                                        |
| `src/__tests__/clientDoulaAssignmentAccess.test.ts` | Negative matrix (assigned/unassigned/inactive doula, client, billing, unauthenticated, altered ids, admin)                                   |
| `src/__tests__/clientDocumentsController.test.ts`   | Expect 404 for unassigned doula document list                                                                                                |

---

## Verification matrix

| Actor               | GET detail      | GET activities | POST activity | Expected |
| ------------------- | --------------- | -------------- | ------------- | -------- |
| Assigned doula      | 200             | 200            | 201/200       | Pass     |
| Unassigned doula    | 404, no DB read | 404            | 403           | Pass     |
| Inactive assign     | 404             | 404            | 403           | Pass     |
| Client (other id)   | 403             | 403            | —             | Pass     |
| Billing             | 403             | 403            | 403           | Pass     |
| Unauthenticated     | 403             | 403            | 403           | Pass     |
| Altered client UUID | 404             | 404            | 403           | Pass     |
| Admin               | 200             | 200            | 200           | Pass     |

```bash
npm test -- --testPathPattern="clientDoulaAssignmentAccess|clientDocumentsController"
```

**Result (2026-08-25):** 27/27 passed (assignment suite + document auth
regression).

---

## Production deployment

| Item             | Value                   |
| ---------------- | ----------------------- |
| Backend commit   | _filled post-deploy_    |
| Service          | `sokana-private-api`    |
| Region           | `us-central1`           |
| Reviewer / date  | Jerry Bony / 2026-08-25 |
| Closure approval | Jerry Bony / 2026-08-25 |

---

## Residual notes

- `canAccessSensitive` still reads Supabase `assignments.status = 'active'`;
  Cloud SQL `doula_assignments` parity tracked under architecture boundary work
  (`.cursor/handoffs/open/2026-08-10-backend-architecture-boundary-refactor.md`).
- `GET /clients/:id` for unassigned doulas previously returned operational DTO
  (names/contact) with PHI stripped — that partial leak is closed.
