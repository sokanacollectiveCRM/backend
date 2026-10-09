# Handoff: Public intake CORS Idempotency-Key + Nancy required fields

## Metadata

- Direction: `frontend->backend`
- Priority: `P0`
- Requested By: Nancy Cowans / Sokana Collective (dev pilot, starts Monday Oct
  12, 2026)
- Date: `2026-10-09`
- Status: `open`
- Related Links:
  - Frontend PR: https://github.com/sokanacollectiveCRM/frontend/pull/103
  - Frontend handoff:
    `.cursor/handoffs/open/2026-10-09-backend-intake-cors-language.md`
  - Dev frontend: `https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app`
  - Dev API: `https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app`

## Why This Is Needed

- Browser submit dies as **Failed to fetch** because CORS preflight does not
  allow `Idempotency-Key`.
- Server-side validation still requires fields Nancy made optional, so a
  frontend-valid Nancy-only submit 400s on the live API.

## Requested Changes

- [ ] Add `Idempotency-Key` to CORS `allowedHeaders`.
- [ ] Relax public-intake required validation to Nancy's 2026-10-09 set.
- [ ] Accept and persist `primary_language_other`.
- [ ] Derive or accept optional `client_age_range`.
- [ ] Keep intake Idempotency-Key replay working.

## Acceptance Criteria

- [ ] OPTIONS preflight from the dev frontend origin with
      `Access-Control-Request-Headers: content-type,idempotency-key` returns
      `Access-Control-Allow-Headers` containing `Idempotency-Key`.
- [ ] Minimal Nancy payload validates and inserts.
- [ ] Missing required fields return 400 naming the fields.

## Implementation Notes

- CORS origin allowlist is already correct; do not change it.
- Do not merge to prod; deploy to the **dev** Cloud Run API first.
