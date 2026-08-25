# HIPAA-05 — Verification & Compliance Sign-Off

**Ticket:** HIPAA-05 — Remove PHI from doula-assignment emails  
**Related:** `docs/HIPAA_05_DOULA_ASSIGNMENT_EMAIL_STATUS.md`

---

## Scope verified

Doula assignment notification no longer includes client email, client name,
assignment notes, or clinical content. Doula receives client number +
authenticated CRM activities deep-link only. Subject contains no PHI.

---

## Production environment

| Item             | Value                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| Service          | `sokana-private-api`                                                    |
| Region           | `us-central1`                                                           |
| Project          | `sokana-private-data`                                                   |
| Serving revision | _Pending deploy_                                                        |
| Image            | _Pending deploy_                                                        |
| Git commit       | _Pending merge_                                                         |
| `FRONTEND_URL`   | `https://sokana-front-end-634744984887.us-central1.run.app` (unchanged) |

---

## Verification results

| Test                                                                        | Expected                                                          | Observed     | Result  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ | ------- |
| Automated template tests (`doulaAssignmentNotificationEmail.test.ts`)       | prohibited labels/values absent; client number + CRM link present | Pass (local) | Pass    |
| Subject free of client-identifying information                              | no names/emails/client number in subject                          | Pass (local) | Pass    |
| CRM URL uses opaque id path only                                            | `/doula-dashboard/activities/{id}`; no query PHI                  | Pass (local) | Pass    |
| Production image SHA matches merge commit                                   | revision serves merge SHA                                         | _Pending_    | Pending |
| Production assignment email spot-check (test match in staging/prod if used) | no client email/notes in body                                     | _Pending_    | Pending |

---

## Residual risk (acknowledged)

- Client-facing match email (`sendClientMatchNotification`) unchanged; still
  includes doula name + email.
- Doula SMTP `to` remains the doula workforce address (delivery requirement).
- Assignment notes persist in database; only email transport was minimized.

---

## Code & evidence references

- Template:
  `src/features/assignments/notifications/doulaAssignmentNotificationEmail.ts`
- Controller: `src/controllers/adminController.ts` (`matchDoulaWithClient`)
- Email service: `src/services/emailService.ts` (`sendDoulaMatchNotification`)
- Status: `docs/HIPAA_05_DOULA_ASSIGNMENT_EMAIL_STATUS.md`
- Tests: `src/__tests__/doulaAssignmentNotificationEmail.test.ts`

---

## Formal closure approval

| Field              | Value        |
| ------------------ | ------------ |
| Reviewer           | _Pending_    |
| Review date        | _Pending_    |
| Closure approved   | _Pending_    |
| Exception / waiver | None planned |

_Update this section after merge, CI pass, and production deploy confirmation._
