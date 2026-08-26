# Identity Platform Admin Migration Sign-off

**Date:** 2026-08-26  
**Scope:** Admin accounts only  
**Status:** Completed for the admin cohort; broader WS-2 remains open

## Target boundary

- Authentication: GCP Identity Platform
- Administrator role/profile source: Cloud SQL `public.admins`
- Session authorization: Cloud Run API resolves the Identity Platform email
  against Cloud SQL; Identity Platform claims do not grant administrator role.
- Second factor: application email OTP after password authentication
- Supabase Auth: retained temporarily for unmigrated doulas and clients during
  the dual-verification window

## Migration result

- Cloud SQL admin cohort: 4
- Existing Identity Platform admin updated: 1
- Supabase admin accounts created in Identity Platform: 3
- Forced password-reset emails sent: 4
- New Identity Platform accounts preserved their Supabase UID: 3 of 3
- Missing/blocked admin accounts: 0

Reset links use the production frontend continue URL:

`https://sokana-front-end-634744984887.us-central1.run.app/login`

## Role verification

Admin privileges were not copied into user-editable Identity Platform metadata.
The backend continues to resolve administrator access from the normalized email
in Cloud SQL `public.admins`. Where an Identity Platform UID differs from the
Cloud SQL UUID, the backend maps by email and returns the Cloud SQL UUID for
downstream authorization and foreign-key compatibility.

## Operational controls

- Migration script is dry-run by default.
- Apply mode requires `--apply`.
- Apply mode refuses localhost reset links unless explicitly overridden.
- Supabase Auth inventory is read only.
- Reset links and plaintext credentials are never printed.
- The migration is idempotent; reruns update existing Identity Platform users.

## Verification evidence

- Pre-apply dry-run: 1 existing Identity account, 3 accounts to create
- Apply summary: `updated=1`, `created=3`, `reset_sent=4`
- TypeScript typecheck passed
- Identity login, Cloud SQL role resolution, email OTP, and password reset were
  previously exercised successfully for the test administrator

## Residual work

- Admins must complete their emailed password reset before signing in.
- Keep `AUTH_PROVIDER=dual` until the reset completion window is closed.
- Doulas and clients remain outside this phase and must not be represented as
  migrated.
- Do not remove Supabase Auth keys or disable Supabase Auth until the remaining
  cohorts are migrated and verified.

## Password-reset resend evidence — 2026-08-26

Before resending, a read-only Identity Platform metadata check compared the
four-admin cohort against the original send at approximately `16:05Z`:

- Completion evidence found: 1 admin (successful sign-in after the original
  migration email)
- No completion evidence: 3 admins (no Identity Platform sign-in)
- Disabled accounts: 0

The completed admin was excluded. Fresh production reset links were sent only to
the three pending admins at approximately `18:37Z`:

- `skipped_completed=1`
- `updated=3`
- `reset_sent=3`
- SMTP accepted all three sends with status 200
- Missing/blocked accounts: 0

Production evidence for the completed admin includes successful
`POST /auth/session`, `POST /auth/mfa/verify`, `GET /auth/me`, and dashboard
requests after the Identity Platform IAM and dual-auth configuration fixes.

Current recipient completion status is 1 of 4 verified, with 3 awaiting human
password reset and first sign-in. SMTP acceptance is delivery submission
evidence, not proof of inbox receipt. `AUTH_PROVIDER=dual` remains required.
