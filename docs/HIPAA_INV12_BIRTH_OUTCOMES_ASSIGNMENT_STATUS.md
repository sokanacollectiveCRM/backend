# INV-12 / Birth-Outcomes Assignment Authorization

**Finding:** `PUT /clients/:id/birth-outcomes` allowed any authenticated doula;
handler did not call `canAccessSensitive`. Production UI also saved via generic
`PUT /clients/:id`, bypassing validation and assignment checks.

**Remediation:**

- `updateClientBirthOutcomes` calls `canAccessSensitive` (admin or assigned doula).
- Generic `PUT /clients/:id` rejects all birth-outcomes keys (legacy narrative +
  structured fields) with 400 → use dedicated route.
- Legacy free-text `birth_outcomes` removed from API responses and CRM UI.
- CRM save flows call `PUT /clients/:id/birth-outcomes` (dropdowns/checkboxes only).

---

## Code changes

| Area | Change |
| ---- | ------ |
| `src/controllers/clientController.ts` | Assignment gate; strip legacy `birth_outcomes` from responses; block birth keys on generic update |
| `src/constants/phiFields.ts` | `BIRTH_OUTCOMES_WRITE_KEYS` + `findBirthOutcomesWriteKeys` |
| `src/repositories/cloudSqlClientRepository.ts` | Drop `birth_outcomes` from operational update allowlist |
| `src/dto/response/ClientDetailDTO.ts` | Remove legacy `birth_outcomes` field |
| `frontend-crm` | `updateClientBirthOutcomes()`; ActivitiesTab + LeadProfileModal wired to dedicated route; legacy read-only UI removed |

---

## Verification matrix

| Test | Expected | Automated |
| ---- | -------- | --------- |
| Assigned doula update | 200 + persisted fields | `clientBirthOutcomesEndpoint.test.ts` |
| Unassigned doula | 403; no DB read | `clientBirthOutcomesEndpoint.test.ts` |
| Unauthenticated | 401 | `clientBirthOutcomesAuth.test.ts` |
| Admin update | 200 | `clientBirthOutcomesEndpoint.test.ts` |
| Generic PUT with structured fields | 400 | `clientBirthOutcomesEndpoint.test.ts` |
| Generic PUT with legacy narrative | 400 | `clientBirthOutcomesEndpoint.test.ts` |
| GET client detail | Structured fields only (no narrative) | `clientBirthOutcomesEndpoint.test.ts` |

```bash
npm test -- --testPathPattern="clientBirthOutcomes"
```

**Result (2026-08-23):** 19/19 passed.

---

## Production deployment (pending)

| Item | Value |
| ---- | ----- |
| PR / commit | _TBD at merge_ |
| Serving revision | _TBD after deploy_ |
| Reviewer / date | _TBD_ |
| Closure approval | _TBD_ |

---

## Residual notes

- DB column `phi_clients.birth_outcomes` may still exist for historical rows; it is
  no longer writable via API or shown in CRM. Admin CSV export may still include
  the column until a separate export cleanup.
- `canAccessSensitive` assignment lookup uses Supabase `assignments.status =
  'active'`; Cloud SQL assignment parity is tracked under architecture boundary work.
