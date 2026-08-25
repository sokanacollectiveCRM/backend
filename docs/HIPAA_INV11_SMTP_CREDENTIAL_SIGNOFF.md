# HIPAA-10 / INV-11 — Hardcoded SMTP Credential Removal Sign-Off

**Ticket:** INV-11 — Hardcoded Gmail application password in repository  
**Finding:** Gmail SMTP app password was committed in
`src/scripts/sendTestEmail.ts`.  
**Related:** `docs/HIPAA_BOARD_TECHNICAL_STATUS.md`,
`docs/EMAIL_CONFIGURATION.md`

---

## Scope verified

The exposed Gmail application password was **rotated and revoked** in Google
Account settings. The hardcoded value is **removed from active source**. Runtime
SMTP auth uses **`EMAIL_PASSWORD` from environment** — production via **Google
Secret Manager → Cloud Run secret ref**. **No secret values appear in this
document, tickets, or test output.**

---

## Production environment

| Item                  | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Service               | `sokana-private-api`                                                    |
| Region                | `us-central1`                                                           |
| Project               | `sokana-private-data`                                                   |
| Serving revision      | `sokana-private-api-00049-5wh`                                          |
| Secret Manager        | `EMAIL_PASSWORD` version `1` (2026-08-25T21:43:31Z)                     |
| Cloud Run SA accessor | `sokana-private-storage-sa@sokana-private-data.iam.gserviceaccount.com` |

---

## Verification results (2026-08-25)

| Check                              | Expected                     | Observed                                                                                                  | Result |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| Hardcoded secret in tracked source | None                         | Removed from `sendTestEmail.ts`                                                                           | Pass   |
| `.env` gitignored                  | Not committed                | `.env` not in `git ls-files`                                                                              | Pass   |
| `NodemailerService` uses env only  | `process.env.EMAIL_PASSWORD` | Confirmed in `emailService.ts`                                                                            | Pass   |
| `sendTestEmail.ts` uses env only   | `resolveSmtpConfigFromEnv()` | No literal password assignment                                                                            | Pass   |
| Automated containment tests        | Pass                         | `smtpCredentialContainment.test.ts` (4/4)                                                                 | Pass   |
| Gmail app password rotated         | Old password revoked         | Operator confirmed rotation                                                                               | Pass   |
| Secret Manager `EMAIL_PASSWORD`    | Version stored               | Version `1` enabled                                                                                       | Pass   |
| Cloud Run secret bind              | `EMAIL_PASSWORD:latest`      | Revision `00049-5wh`; all secrets restored (`DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PASSWORD`) | Pass   |
| SMTP delivery test                 | `250 2.0.0 OK`               | `sendTestEmail.ts` → staff inbox; Gmail accepted                                                          | Pass   |

---

## Repository / config references

| Item                         | Location                                              |
| ---------------------------- | ----------------------------------------------------- |
| Removed hardcoded credential | `src/scripts/sendTestEmail.ts`                        |
| Production mail transport    | `src/services/emailService.ts`                        |
| Containment tests            | `src/__tests__/smtpCredentialContainment.test.ts`     |
| Local dev (gitignored)       | `.env` — `EMAIL_PASSWORD` updated after rotation      |
| Secret Manager               | `projects/sokana-private-data/secrets/EMAIL_PASSWORD` |

---

## Git history exposure (no secret values)

Historical scan: the leaked app-password string appeared **only** in
`src/scripts/sendTestEmail.ts`, from initial repository history until this
remediation. **Old password revoked in Google** — history no longer grants SMTP
access. Optional follow-up: `git filter-repo` to purge blob (team coordination).

---

## Residual risk (acknowledged)

- **Git history** may still contain the old string in commits; mitigated by
  rotation/revocation in Google.
- **Other Cloud Run plaintext secrets** (`STRIPE_SECRET_KEY`,
  `QB_CLIENT_SECRET`) remain; migrate per SECURITY_P0 roadmap.
- **Mailbox retention** — separate HIPAA/BAA item.

---

## Sign-off

I confirm that INV-11 has been **implemented, rotated, deployed to production,
and verified** as described above. SMTP credentials are no longer hardcoded in
source; production reads `EMAIL_PASSWORD` from Secret Manager.

| Field             | Value                                          |
| ----------------- | ---------------------------------------------- |
| **Reviewer**      | Jerry Bony                                     |
| **Role**          | Engineering verification / compliance reviewer |
| **Sign-off date** | 2026-08-25                                     |
| **Status**        | **Verified — closed**                          |

**Rotation evidence (no secret values):** Secret Manager `EMAIL_PASSWORD` v1
timestamp; Cloud Run `00049-5wh` env shows `EMAIL_PASSWORD` secret ref; SMTP
test returned `250 2.0.0 OK`.

---

## Change log

| Date       | Change                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-08-25 | Removed hardcoded SMTP password; containment tests; Secret Manager + Cloud Run bind; rotation + delivery verified |
