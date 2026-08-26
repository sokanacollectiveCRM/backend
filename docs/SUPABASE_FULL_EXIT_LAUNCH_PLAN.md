# Decision: Full Supabase Exit — Launch-Ready Plan

**Date:** 2026-08-25  
**Decision owner:** Jerry Bony  
**Status:** **Approved — migrate everything; no staff-only carve-out as
strategy**

---

## Decision

Sokana will be **launch-ready by exiting Supabase entirely**, not by launching
with Supabase Free under a staff-only exception.

| Path                                                             | Outcome                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Staff-only carve-out + defer Identity Platform                   | **Rejected as strategy**                                   |
| Temporary Supabase BAA + Free/upgrade bridge                     | Optional **bridge only** if schedule slips; not the target |
| **Full migration** (Auth → GCS → table cutover → delete project) | **Approved plan**                                          |

**Launch gate:** No client/family accounts in production until Auth is off
Supabase (GCP Identity Platform or equivalent under Google BAA). Staff CRM may
soft-pilot only if portal invite/login is hard-disabled — that is a temporary
ops control during migration, not the end state.

---

## Why

- Client portal already authenticates via Supabase (invite → set-password →
  client login). Email/phone tied to maternal-care services can be PHI.
- PHI/document bytes still flow through Supabase Storage without in-repo BAA
  evidence.
- Dual datastore (Cloud SQL + leftover Supabase tables) is a compliance and ops
  tax.
- Board boundary: _client-facing launch → migrate first or get Supabase BAA._
  Chosen path: **migrate everything.**

---

## Target architecture (launch)

| Concern                               | Target                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Authentication (staff, doula, client) | **GCP Identity Platform** (Firebase Auth / Identity Platform under Google) |
| Authorization                         | Cloud Run API on every protected request (unchanged requirement)           |
| Operational + PHI structured data     | **Private Cloud SQL** only                                                 |
| Document / contract bytes             | **Private GCS** (CMEK or Google-managed per hardening plan)                |
| Supabase                              | **Gone** — Auth off, DB unused, Storage empty, project deleted             |

---

## Workstreams (ordered)

### WS-0 — Freeze (immediate)

- [ ] Disable public registration (keep invite-gated staff signup only if
      needed)
- [ ] **Hard-disable client portal invite + client login** until Auth cutover
- [ ] Document freeze in board status / this decision doc
- [ ] No new Supabase table or Storage usage

### WS-1 — Inventory & kill-switches (days)

- [ ] Refresh live usage vs `docs/SUPABASE_DATABASE_USAGE_INVENTORY.md`
- [ ] List every Auth role (admin, doula, client) and session transport
- [ ] Confirm QuickBooks tokens are Cloud SQL only; rotate any residual secrets
- [ ] Feature flags / env gates: `PORTAL_AUTH_DISABLED=true`, etc.

### WS-2 — Auth migration (GCP Identity Platform) — **critical path**

- [ ] Provision Identity Platform in `sokana-private-data` (or approved project)
- [ ] Map roles: staff (`admins`), doulas (`doulas`), clients
      (`phi_clients.user_id`)
- [ ] Backend: replace `supabase.auth.getUser` / login / invite / recovery with
      Identity Platform token verify + admin user APIs
- [ ] Frontend: replace Supabase JS client for staff + doula + portal
- [ ] Migrate existing Auth users (or re-invite workforce; re-invite clients
      only after cutover)
- [ ] Cutover: dual-verify window → Identity Platform only → remove Supabase
      Auth keys from Cloud Run

### WS-3 — Object storage off Supabase

- [x] GCS layout: one private bucket `sokana-private-documents` with type
      prefixes (not separate buckets) — `docs/GCS_DOCUMENT_STORAGE.md`
- [x] Contract templates cut over to GCS (services + FE preview)
- [x] Client documents cut over to GCS (upload/delete/signed URL)
- [x] Doula documents cut over to GCS (upload/delete/signed URL)
- [x] Profile pictures cut over to GCS + existing images migrated per user
      folder
- [ ] Update remaining upload/download services; signed URLs via backend only
- [ ] Migrate existing objects; verify; empty Supabase buckets

### WS-4 — Structured data: Cloud SQL only

- [ ] Eliminate remaining Supabase table reads/writes (users, notes, assignments
      legacy, contracts/payments dual paths, etc.)
- [ ] Fix `sensitiveAccess` / assignment authz to Cloud SQL only
- [ ] Remove Supabase JS DB clients from backend except temporary stubs behind
      kill switch

### WS-5 — Decommission Supabase

- [ ] Rotate and remove `SUPABASE_*` from Cloud Run + frontend builds
- [ ] Disable Auth providers; empty Storage; drop unused tables (or leave
      read-only archive if legal requires — document)
- [ ] Delete or pause Supabase project; cancel paid plan if any
- [ ] Closure sign-off (mirror Vercel retirement pattern)

---

## Launch-ready definition

Launch-ready **for client-facing CRM** means all of:

1. Identity Platform authenticates staff, doulas, **and** clients
2. No Supabase Auth in the request path
3. No PHI bytes in Supabase Storage
4. No live CRM writes to Supabase Postgres
5. Cloud Run authz on every protected route
6. Written sign-off + residual risks

Staff-only soft pilot **during** WS-2 is allowed only with portal hard-disabled.

---

## Out of scope for this program

- Re-adding Vercel
- Expanding vendor surface without BAA register update
- Claiming HIPAA compliance from migration alone (BAAs/policies still required)

---

## Related

- `docs/SUPABASE_DATABASE_USAGE_INVENTORY.md`
- `docs/HIPAA_BOARD_TECHNICAL_STATUS.md` (HIPAA-15 vendors; Storage residual)
- `docs/VERCEL_RETIREMENT_SIGNOFF.md` (pattern for closure evidence)
- Handoff: `.cursor/handoffs/open/2026-08-25-full-supabase-exit-launch-ready.md`
