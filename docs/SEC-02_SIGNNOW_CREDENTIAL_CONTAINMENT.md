# SEC-02 — Exposed SignNow Credential Containment

Status: Source containment implemented locally; credential-owner confirmation and rotation pending.

## Finding

A credential-shaped value was embedded in `src/routes/pdfContractRoutes.ts` and supplied to the PDF contract processing workflow as a SignNow bearer token. The affected boundary is the mounted `/api/pdf-contract` router. The value is intentionally omitted from this record.

Git history shows the reference was introduced in commit `a003d33b1add2c2defc3e1f8ad190b0fb61ca15d` on 2025-11-10 and persisted in later commits. Removing it from the current source does not remove it from repository history.

## Local containment

- Removed the embedded value from current source.
- Required runtime injection through `SIGNNOW_ACCESS_TOKEN`; missing configuration fails closed with HTTP 503.
- Required authentication and the admin role for the PDF-contract router.
- Disabled the PDF-contract test workflow in production.
- Added regression coverage for unauthenticated 401, unauthorized 403, and absence of a long embedded token literal.

## Required external actions

- An authorized SignNow account owner must determine whether the historical credential is or was active.
- If real, revoke or rotate it and assess provider audit activity from the exposure window.
- Store any replacement in Google Secret Manager during the authorized Cloud Run configuration phase.
- Confirm staging and production revisions inject the replacement without exposing its value.
- Add repository secret scanning to release checks and decide whether history rewriting is necessary after rotation.

No credential was tested, copied, rotated, revoked, or deployed during this work.
