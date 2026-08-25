# HIPAA-13F — Remove clinical information from intake emails

**Ticket:** HIPAA-13F / INV-01  
**Date:** 2026-08-24  
**Status:** **Contained in code** (pending production deploy + formal sign-off).

---

## What changed

Public intake (`POST /requestService/requestSubmission`) no longer emails the
full identity + clinical intake payload to staff Gmail.

| Email | Before | After (approved template) |
| ----- | ------ | ------------------------- |
| Staff (`hello@sokanacollective.com`) | Full intake (health history, address, income, due date, partner, insurance, demographics, etc.) | Subject `New lead submitted`; body = **client number** + **authenticated CRM link** only |
| Submitter confirmation | Greeting with legal name | Generic thank-you; **no name/clinical content** in subject or body |

Full intake remains in Cloud SQL (`phi_clients`) and is viewed only after CRM
authentication.

---

## Approved staff notification template

**Subject:** `New lead submitted`

**Body (plain text equivalent):**

```text
A new lead was submitted via the public request form.

Client number: CL-XXXXX

Open the CRM to review the incoming request for service:
{FRONTEND_URL}/admin/clients/{clientId}

Do not reply to this message with client details.
```

**Production `FRONTEND_URL`:**  
`https://sokana-front-end-634744984887.us-central1.run.app`

**CRM deep-link behavior:** `/admin/clients/{clientId}` is the staff Clients
route; after auth it opens that lead’s **Lead Profile modal** (frontend deep-link
in `Clients.tsx` / `UsersDialogs`).

**Rules:**

- No clinical fields (health history, allergies, notes, pregnancy, medications).
- No identity/contact fields in subject or body (name, email, phone, address).
- No income, insurance IDs, demographics, or referral PHI in the email.
- CRM URL path uses opaque client id only (no PHI query params).
- Application logs on this path use metadata-only logger fields (no payload).

Implementation:
`src/features/intake/notifications/intakeStaffNotificationEmail.ts`  
Wired from: `src/controllers/requestFormController.ts`

---

## Tests

- `src/__tests__/intakeStaffNotificationEmail.test.ts` — template unit tests
  (forbidden labels/values absent; client number + CRM link present).
- `src/__tests__/requestEndpoint.test.ts` — integration asserts staff mail has
  no clinical/identity payload from the mock intake.

---

## Residual risk

- SMTP `to` for the submitter confirmation is still the submitter email
  (required for delivery).
- `USE_TEST_EMAIL=true` still logs recipient address in `emailService` (dev/test
  mode); production uses SMTP without that dump.
- Assignment / match emails (HIPAA-05) are a separate minimization item.

---

## Related docs

- Inventory: `docs/HIPAA_TECHNICAL_PHI_INVENTORY.md` (INV-01)
- Board: `docs/HIPAA_BOARD_TECHNICAL_STATUS.md`
- Email overview: `docs/EMAIL_NOTIFICATION_SYSTEM.md`
