# HIPAA-05 — Verification & Compliance Sign-Off

**Ticket:** HIPAA-05 — Remove PHI from doula-assignment emails  
**Related:** `docs/HIPAA_05_DOULA_ASSIGNMENT_EMAIL_STATUS.md`, PR #84, commit
`e2588e5`

---

## Scope verified

Doula assignment notification no longer includes client email, client name,
assignment notes, or clinical content. Doula receives client number +
authenticated CRM activities deep-link only. Subject contains no PHI.

---

## Production environment

| Item             | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| Service          | `sokana-private-api`                                                          |
| Region           | `us-central1`                                                                 |
| Project          | `sokana-private-data`                                                         |
| Serving revision | `sokana-private-api-00044-bhf`                                                |
| Image            | `us-central1-docker.pkg.dev/sokana-private-data/backend-repo/api:latest`      |
| Git commit       | `e2588e5` (merge PR #84, 2026-08-25)                                          |
| Cloud Build      | SUCCESS `2026-08-25T21:12:10Z` (build `eb72fed6-f749-4ba9-999c-8bfaf677f8c3`) |
| `FRONTEND_URL`   | `https://sokana-front-end-634744984887.us-central1.run.app`                   |

---

## Verification results (2026-08-25)

| Test                                                                  | Expected                                                          | Observed                                     | Result |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- | ------ |
| Automated template tests (`doulaAssignmentNotificationEmail.test.ts`) | prohibited labels/values absent; client number + CRM link present | Pass (local + CI PR #84)                     | Pass   |
| Subject free of client-identifying information                        | no names/emails/client number in subject                          | Pass (local + CI)                            | Pass   |
| CRM URL uses opaque id path only                                      | `/doula-dashboard/activities/{id}`; no query PHI                  | Pass (local + CI)                            | Pass   |
| CI lint + Install/build/test/security smoke (PR #84)                  | pass                                                              | pass                                         | Pass   |
| Production revision serves latest deploy                              | `00044-bhf` active                                                | Confirmed via `gcloud run services describe` | Pass   |
| Production `FRONTEND_URL`                                             | Cloud Run frontend URL                                            | Confirmed on service env                     | Pass   |

---

## Residual risk (acknowledged)

- Client-facing match email (`sendClientMatchNotification`) unchanged; still
  includes doula name + email — separate minimization item.
- Doula SMTP `to` remains the doula workforce address (delivery requirement).
- Assignment notes persist in Cloud SQL; only email transport was minimized.

---

## Code & evidence references

- Template:
  `src/features/assignments/notifications/doulaAssignmentNotificationEmail.ts`
- Controller: `src/controllers/adminController.ts` (`matchDoulaWithClient`)
- Email service: `src/services/emailService.ts` (`sendDoulaMatchNotification`)
- Status: `docs/HIPAA_05_DOULA_ASSIGNMENT_EMAIL_STATUS.md`
- Tests: `src/__tests__/doulaAssignmentNotificationEmail.test.ts`
- Preview: `scripts/preview-doula-assignment-notification-email.ts`

---

## Formal closure approval

| Field              | Value                                             |
| ------------------ | ------------------------------------------------- |
| Reviewer           | Engineering (HIPAA-05 implementation + deploy)    |
| Review date        | 2026-08-25                                        |
| Closure approved   | Yes — production revision `00044-bhf` serving     |
| Exception / waiver | None; client match email tracked as separate item |
