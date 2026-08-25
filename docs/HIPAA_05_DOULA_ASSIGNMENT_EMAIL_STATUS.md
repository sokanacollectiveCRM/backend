# HIPAA-05 — Remove PHI from doula-assignment emails

**Ticket:** HIPAA-05 (assignment email path)  
**Date:** 2026-08-25  
**Status:** **Closed in production** (PR #84, revision
`sokana-private-api-00044-bhf`; see `docs/HIPAA_05_VERIFICATION_SIGNOFF.md`).

---

## What changed

Admin doula match (`POST /api/admin/assignments/match`) no longer emails client
name, client email, or assignment notes to the assigned doula.

| Email                         | Before                                                                 | After (approved template)                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Doula assignment notification | Client name + email + optional assignment notes; generic dashboard URL | Subject `New client assignment`; body = **client number** + **authenticated CRM activities deep-link** only |

Full client profile, notes, and clinical data remain in Cloud SQL and are viewed
only after CRM authentication.

**Out of scope (separate item):** client-facing match email
(`sendClientMatchNotification`) still includes doula name + email.

---

## Approved doula assignment notification template

**Subject:** `New client assignment`

**Body (plain text equivalent):**

```text
You have been assigned a new client.

Client number: CL-XXXXX

Open the CRM to review the assignment and client activities:
{FRONTEND_URL}/doula-dashboard/activities/{clientId}

Do not reply to this message with client details.
```

**Production `FRONTEND_URL`:**  
`https://sokana-front-end-634744984887.us-central1.run.app`

**CRM deep-link behavior:** `/doula-dashboard/activities/{clientId}` is the
doula Activities route; after auth it opens that client’s activities view
(frontend `DoulaDashboardRoutes.tsx`).

**Rules:**

- No assignment notes or admin free-text in subject or body.
- No client identity/contact fields (name, email, phone, address).
- No clinical, financial, insurance, or demographic fields.
- CRM URL path uses opaque client id only (no PHI query params).
- Application logs on this path use metadata-only logger fields (no email
  addresses in match-notification success/failure logs).

Implementation:
`src/features/assignments/notifications/doulaAssignmentNotificationEmail.ts`  
Wired from: `src/controllers/adminController.ts` →
`emailService.sendDoulaMatchNotification`

---

## Tests

- `src/__tests__/doulaAssignmentNotificationEmail.test.ts` — template unit tests
  (forbidden labels/values absent; client number + CRM link present; subject
  free of PHI).

---

## Residual risk

- Client match email (`sendClientMatchNotification`) still includes client and
  doula names/emails — separate minimization item if leadership requires it.
- SMTP `to` for doula assignment is still the doula workforce email (required
  for delivery).
- Assignment notes are still stored in Cloud SQL; they are no longer copied into
  email.

---

## Related docs

- `docs/HIPAA_05_VERIFICATION_SIGNOFF.md` (formal closure after deploy)
- `docs/HIPAA_BOARD_TECHNICAL_STATUS.md`
- `docs/HIPAA_TECHNICAL_PHI_INVENTORY.md` §14 email matrix
