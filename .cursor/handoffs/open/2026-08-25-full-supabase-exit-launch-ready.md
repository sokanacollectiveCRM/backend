# Handoff: Full Supabase exit — launch-ready migration

## Metadata

- Direction: `compliance->backend+frontend+infra`
- Priority: `P0` (launch-ready)
- Requested By: Jerry Bony
- Date: `2026-08-25`
- Status: `open`
- Related Links:
  - `docs/SUPABASE_FULL_EXIT_LAUNCH_PLAN.md` (**decision: migrate everything**)
  - `docs/SUPABASE_DATABASE_USAGE_INVENTORY.md`
  - `docs/HIPAA_BOARD_TECHNICAL_STATUS.md`
  - `docs/ENDPOINT_AUTHORIZATION_MATRIX.md`
  - `docs/IDENTITY_PLATFORM_ADMIN_MIGRATION_SIGNOFF.md`

## Why This Is Needed

Launch strategy is **full Supabase exit**, not a staff-only Free-plan carve-out.
Client portal already uses Supabase Auth; PHI/docs still touch Supabase Storage.
Client-facing launch requires Identity Platform (or equivalent) + data off
Supabase before family accounts go live.

## Decision (locked)

- **Migrate everything** (Auth + Storage + leftover tables → decommission
  project).
- Staff-only soft pilot is only an interim control (portal hard-disabled), not
  the target architecture.
- Optional Supabase BAA is a **bridge if schedule slips**, not the plan.

## Requested Changes

### WS-0 Freeze (do first)

- [ ] Hard-disable client portal invite + client login / set-password in prod
- [ ] Disable open public registration (invite-gated staff only if required)
- [ ] No new Supabase Storage or table usage

### WS-1 Inventory

- [ ] Diff live code vs `SUPABASE_DATABASE_USAGE_INVENTORY.md`
- [ ] Confirm QB tokens Cloud SQL only; rotate residuals
- [ ] List Auth user cohorts (admin / doula / client)

### WS-2 Auth → GCP Identity Platform (critical path)

- [x] Provision Identity Platform
- [ ] Backend token verify + login/invite/recovery for staff, doula, client
- [ ] Frontend remove Supabase auth client for all roles
- [ ] User migration or re-invite plan
- [ ] Cutover; remove Supabase Auth from Cloud Run env

#### WS-2 admin-only phase (2026-08-26)

- [x] Use Cloud SQL `public.admins` as the authoritative admin cohort/role
- [x] Dry-run Supabase Auth → Identity Platform admin migration
- [x] Create 3 missing Identity Platform admin accounts
- [x] Update 1 existing Identity Platform admin account
- [x] Preserve Supabase UID for all 3 newly created accounts
- [x] Send forced password-reset emails to all 4 admins
- [x] Check prior reset completion before resend (1 complete, 3 pending)
- [x] Resend fresh production reset links only to the 3 pending admins
- [x] Keep dual token verification for the remaining doula/client cohorts
- [x] Write `docs/IDENTITY_PLATFORM_ADMIN_MIGRATION_SIGNOFF.md`

### WS-3 Storage → GCS

- [x] Bucket layout decided: single `gs://sokana-private-documents` + type
      prefixes (`client-documents/`, `doula-documents/`, `contracts/`,
      `contract-templates/`, `profile-pictures/`) — see
      `docs/GCS_DOCUMENT_STORAGE.md`
- [x] Contract templates live in GCS (list/get/upload/delete + FE
      signed-url/download)
- [x] Client documents upload/download/delete/signed URL → GCS
      (`client-documents/`); verified with
      `scripts/verify-client-document-gcs.ts`
- [x] Doula documents upload/download/delete/signed URL → GCS
      (`doula-documents/`); verified with `scripts/verify-doula-document-gcs.ts`
- [x] Profile pictures → GCS (`profile-pictures/{userId}/`); existing Supabase
      images migrated + Cloud SQL paths updated
      (`scripts/migrate-profile-pictures-to-gcs.ts`)
- [ ] Wire remaining upload/download services (signed contracts)
- [ ] Migrate remaining bytes; cut Supabase Storage

### WS-4 Cloud SQL only

- [ ] Remove remaining Supabase Postgres reads/writes
- [ ] Assignment / notes / users / contracts dual-path cleanup

### WS-5 Decommission

- [ ] Remove `SUPABASE_*` secrets; delete/pause project
- [ ] Write `docs/SUPABASE_EXIT_VERIFICATION_SIGNOFF.md` (closure evidence)

## Acceptance Criteria (launch-ready)

- [ ] No Supabase Auth in production request path
- [ ] No PHI in Supabase Storage
- [ ] No live CRM writes to Supabase Postgres
- [ ] Clients may authenticate only via Identity Platform
- [ ] Cloud Run authz unchanged / verified on protected routes
- [ ] Formal sign-off with reviewer/date/residual risk

## Agent prompt (copy/paste)

```text
TASK: Execute full Supabase exit for Sokana launch readiness.

DECISION (locked 2026-08-25):
- Plan is MIGRATE EVERYTHING — not staff-only carve-out.
- Target: GCP Identity Platform (auth) + Cloud SQL (data) + private GCS (files).
- Supabase must be fully decommissioned before client/family accounts launch.
- Do not put secrets or private URLs in tickets/docs.
- Follow docs/SUPABASE_FULL_EXIT_LAUNCH_PLAN.md and this handoff.

ORDER OF WORK:
0) Freeze: hard-disable portal invite + client login; no new Supabase usage.
1) Inventory: refresh vs docs/SUPABASE_DATABASE_USAGE_INVENTORY.md; QB token check.
2) Auth: provision Identity Platform; migrate staff → doula → client; FE+BE cutover.
3) Storage: move client/contract/doula documents to private GCS.
4) Tables: eliminate remaining Supabase Postgres access; Cloud SQL only.
5) Decommission: remove SUPABASE_* from Cloud Run; delete/pause project; write
   docs/SUPABASE_EXIT_VERIFICATION_SIGNOFF.md.

CONSTRAINTS:
- Cloud Run API must authorize every protected request.
- Do not reintroduce Vercel.
- Do not claim HIPAA complete from migration alone.
- Prefer feature flags / dual-run windows over big-bang silent cutovers.

DONE WHEN launch-ready acceptance criteria in the handoff are all checked.
```

## Completion Summary

Admin-only WS-2 phase completed 2026-08-26. Four Cloud SQL admins now have
Identity Platform accounts and received forced-reset emails; Cloud SQL remains
the authoritative role source. The handoff remains open because doulas, clients,
storage, remaining tables, and Supabase decommissioning are not complete. Before
the admin reset resend, one admin had completed a successful Identity Platform
sign-in; fresh links were sent only to the other three. Those three
recipient-driven resets remain awaiting confirmation.
