# HIPAA-13F — Verification & Compliance Sign-Off

**Ticket:** HIPAA-13F / INV-01 — Remove clinical information from intake
emails  
**Related:** `docs/HIPAA_13F_INTAKE_EMAIL_STATUS.md`, PR #82, commit `043fff3`

---

## Scope verified

Public intake no longer emails the full clinical + identity payload to staff
Gmail. Staff receive a minimal notification (client number + authenticated CRM
deep-link). Submitter confirmation has no name/clinical content in subject or
body. Full intake remains in Cloud SQL and is viewed only after CRM auth.

---

## Production environment

| Item             | Value                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| Service          | `sokana-private-api`                                                    |
| Region           | `us-central1`                                                           |
| Project          | `sokana-private-data`                                                   |
| Serving revision | `sokana-private-api-00042-9cb`                                          |
| Image            | `backend-repo/api:043fff338ae3e73ec072e9071a7992537e79e452`             |
| Git commit       | `043fff338ae3e73ec072e9071a7992537e79e452` (merge PR #82, 2026-08-25)   |
| Cloud Build      | SUCCESS `2026-08-25T20:58:44Z` (trigger `rmgpgab-sokana-private-api-…`) |
| `FRONTEND_URL`   | `https://sokana-front-end-634744984887.us-central1.run.app`             |

---

## Verification results (2026-08-25)

| Test                                                              | Expected                                                          | Observed                                   | Result |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ | ------ |
| Automated template tests (`intakeStaffNotificationEmail.test.ts`) | clinical/identity labels absent; client number + CRM link present | Pass (local + CI)                          | Pass   |
| Endpoint email integration (`requestEndpoint` email cases)        | staff mail has no clinical payload                                | Pass (local + CI)                          | Pass   |
| CI lint + Install/build/test/security smoke (PR #82)              | pass                                                              | pass                                       | Pass   |
| Production image SHA matches merge commit                         | `043fff3…`                                                        | Revision `00042-9cb` serves `api:043fff3…` | Pass   |
| Production `FRONTEND_URL`                                         | Cloud Run frontend URL                                            | Confirmed on service env                   | Pass   |

---

## Residual risk (acknowledged)

- Submitter confirmation SMTP `to` is still the submitter email (delivery).
- Assignment / match emails (HIPAA-05) are a separate minimization item.
- Frontend quiet deep-link miss UX merged in
  [frontend PR #94](https://github.com/sokanacollectiveCRM/frontend/pull/94)
  (`67b75b8`); Cloud Build for `sokana-front-end` was triggered from that merge.

---

## Code & evidence references

- Template: `src/features/intake/notifications/intakeStaffNotificationEmail.ts`
- Controller: `src/controllers/requestFormController.ts`
- Status: `docs/HIPAA_13F_INTAKE_EMAIL_STATUS.md`
- Tests: `src/__tests__/intakeStaffNotificationEmail.test.ts`,
  `src/__tests__/requestEndpoint.test.ts`
- PR: https://github.com/sokanacollectiveCRM/backend/pull/82

---

## Sign-off

I confirm that HIPAA-13F / INV-01 has been **implemented, merged, deployed to
production, and verified** as described above. Public intake staff email no
longer discloses clinical or identity intake fields; staff are directed to the
authenticated CRM.

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| **Reviewer** | Jerry Bony                                     |
| **Role**     | Engineering verification / compliance reviewer |
| **Date**     | 2026-08-25                                     |
| **Decision** | **Closed / verified in production**            |
