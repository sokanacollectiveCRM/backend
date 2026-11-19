# Identity Platform Doula Migration Sign-off

**Date:** 2026-09-07  
**Scope:** The 55 approved doulas in
`outputs/doula-cloudsql-transfer-2026-09-06/approved-transfer.csv`  
**Status:** Staged and disabled pending Sokana notification

## Result

- Approved manifest records: 55
- Approved Cloud SQL doula records: 55
- Identity Platform doula accounts created: 55
- Identity Platform doula accounts linked to `public.doulas`: 55
- Migrated accounts disabled pending notification: 55
- Migrated accounts currently enabled: 0
- Passwords set or migrated: 0
- Invitation, verification, or password-reset emails sent: 0
- Conflicts: 0

Identity Platform contains 59 accounts after this operation: the four previously
migrated administrators and the 55 staged doulas.

## Source reconciliation

The configured Supabase Auth project contained one account matching this cohort.
That account's UID was preserved. The other 54 accounts were staged from the
approved Cloud SQL records using their Cloud SQL UUIDs. The earlier manifest's
"Matching platform account" field therefore did not represent accounts present
in the configured Supabase Auth project at migration time.

## Access state

Every staged doula account is disabled in Identity Platform and has no password.
The accounts cannot authenticate until Sokana intentionally enables them and
initiates its approved onboarding/reset communication. Cloud SQL remains the
authoritative source for doula role, profile, lifecycle state, and assignments.

## Controls

- Migration script is dry-run by default.
- Apply mode uses the exact 55-record approved manifest.
- Cloud SQL rows must exist and have `account_status = 'approved'`.
- Existing administrator identities are protected from collision.
- Role claims are not copied into Identity Platform metadata.
- The script contains no email service or password-reset-link operation.
- Reconciliation verified all 55 Identity Platform-to-Cloud SQL links and all
  55 disabled states.

## Evidence

- Dry run: 55 planned, zero conflicts.
- Apply: 55 created, 55 disabled, zero emails, zero passwords.
- Post-apply: 55 linked records, 55 exact disabled identity matches, zero
  enabled migrated doulas.

