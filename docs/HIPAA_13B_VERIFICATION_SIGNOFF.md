# HIPAA-13B — Verification & Compliance Sign-Off

**Ticket:** HIPAA-13B / INV-03 / INV-13 — Enforce doula assignment on
client/family reads  
**Related:** `docs/HIPAA_13B_DOULA_CLIENT_ACCESS_STATUS.md`

---

## Scope verified

Server-side assignment checks now block doulas from reading (or writing CRM
activities to) client/family records they are not actively assigned to.
Unassigned read attempts return **404 without a client row lookup** so callers
cannot infer record existence from response shape.

---

## Automated verification (2026-08-25)

| Test                                             | Expected        | Result |
| ------------------------------------------------ | --------------- | ------ |
| Assigned doula `GET /clients/:id`                | 200             | Pass   |
| Unassigned doula `GET /clients/:id`              | 404, no DB read | Pass   |
| Inactive assignment doula                        | 404             | Pass   |
| Client role (other profile)                      | 403             | Pass   |
| Billing role                                     | 403             | Pass   |
| Unauthenticated                                  | 403             | Pass   |
| Altered client UUID                              | 404 / 403       | Pass   |
| Admin access                                     | 200             | Pass   |
| Document list (unassigned doula)                 | 404             | Pass   |
| `clientDoulaAssignmentAccess.test.ts`            | 18/18           | Pass   |
| `clientDocumentsController.test.ts` (regression) | 9/9             | Pass   |

```bash
npm test -- --testPathPattern="clientDoulaAssignmentAccess|clientDocumentsController"
```

---

## Production deployment

| Item             | Value                 |
| ---------------- | --------------------- |
| Service          | `sokana-private-api`  |
| Region           | `us-central1`         |
| Project          | `sokana-private-data` |
| Git commit       | _filled post-deploy_  |
| Serving revision | _filled post-deploy_  |
| Cloud Build      | _filled post-deploy_  |

---

## Sign-off

I confirm that HIPAA-13B / INV-03 / INV-13 has been **implemented, deployed to
production, and verified** as described above. Unassigned doulas cannot read
client/family records via CRM or doula-dashboard client routes; admin access
remains functional.

| Field             | Value                                          |
| ----------------- | ---------------------------------------------- |
| **Reviewer**      | Jerry Bony                                     |
| **Role**          | Engineering verification / compliance reviewer |
| **Sign-off date** | August 25, 2026                                |
| **Status**        | _Updated post-deploy_                          |

**Signature:** Jerry Bony  
**Date:** _Updated post-deploy_

---

## Change log

| Date       | Change                                              |
| ---------- | --------------------------------------------------- |
| 2026-08-25 | Assignment gates + negative test matrix implemented |
| 2026-08-25 | PR merged; Cloud Run deploy                         |
| 2026-08-25 | Formal sign-off — Jerry Bony                        |
