# Handoff: Delete Vercel projects and shut down account (cost save)

## Metadata

- Direction: `ops->manual`
- Priority: `P1` (tonight — stop billing)
- Requested By: Jerry Bony
- Date: `2026-08-25`
- Status: `closed`
- Related Links:
  - `docs/VERCEL_RETIREMENT_SIGNOFF.md`
  - Backend PR: https://github.com/sokanacollectiveCRM/backend/pull/87
  - Frontend PR: https://github.com/sokanacollectiveCRM/frontend/pull/95
  - Production hosts: Cloud Run `sokana-private-api`, `sokana-front-end`

## Why This Is Needed

Vercel is already retired from code and production CORS. Projects were
**paused** as an interim step. Pausing may not fully stop plan/seat billing.
Delete the projects and shut down / cancel the Vercel account tonight to stop
charges.

## Context (already done — do not redo)

- Backend CORS no longer allows `*.vercel.app`
- `vercel.json` removed from backend + frontend repos
- Production traffic is on Google Cloud Run only
- Sign-off: `docs/VERCEL_RETIREMENT_SIGNOFF.md`

## Requested Changes (manual Vercel + related cleanup)

- [x] Delete (not just pause) **backend** Vercel project
- [x] Delete (not just pause) **frontend** Vercel project
- [x] Remove any remaining custom domains from Vercel
- [x] Cancel Vercel team/account subscription / delete team if unused
- [x] Confirm billing shows cancel + refund (~$7) expected
- [ ] Supabase Auth → URL Configuration: remove any `*.vercel.app` Site URL /
      redirect URLs; keep Cloud Run frontend only _(spot-check if not done)_
- [x] Spot-check DNS: no production traffic depends on Vercel
- [x] Update `docs/VERCEL_RETIREMENT_SIGNOFF.md` — deleted + account canceled

## Acceptance Criteria

- [x] Both Vercel projects gone (not merely paused)
- [x] Vercel account/team subscription canceled (refund ~$7 pending)
- [x] No production traffic depends on Vercel
- [x] Signoff doc records deletion + account shutdown with date

## Completion Summary

**Closed 2026-08-25.** Jerry canceled Vercel, deleted all projects, and will
receive an ~$7 refund. Signoff updated in `docs/VERCEL_RETIREMENT_SIGNOFF.md`.
Optional leftover: confirm Supabase Auth redirect allow-list has no
`*.vercel.app` entries.
