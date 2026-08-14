# Staff / users CRUD audit (Cloud SQL vs missing Supabase `public.users`)

**Date:** 2026-08-14  
**Context:** Admin Account/Profile save appeared to succeed but did not persist because staff rows live in Cloud SQL (`admins` / `doulas`) while several paths still targeted removed Supabase `public.users`.

## Rule going forward

| Actor | Source of truth |
| --- | --- |
| Admin / doula profile & team CRUD | Cloud SQL `public.admins` / `public.doulas` via `CloudSqlTeamService` |
| Auth session identity | Supabase Auth (`auth.users`) |
| Authoritative role | Cloud SQL team tables (+ optional app-managed role) — never `user_metadata` |
| Client PHI / portal profile | Cloud SQL `phi_clients` / portal endpoints — **not** `/users/update` |

## Fixed in this pass

| Path | Was | Now |
| --- | --- | --- |
| `PUT /users/update` (admin/doula) | Supabase `users` update | Cloud SQL team update (+ admin profile columns) |
| `GET /users/:id` | Supabase `users` | Cloud SQL team first |
| `GET` team lists / `GET /auth/users` | Mixed / Supabase `users` | Cloud SQL `listTeamMembers` |
| `GET /clients/team/doulas` | Forced `bio`/`profile_picture` null | Returns Cloud SQL values |
| `POST /api/admin/doulas/invite` | Inserted Supabase `users` | `CloudSqlTeamService.addTeamMember` |
| Contract “generated_by” user check | Supabase `users` | Cloud SQL team lookup |
| Non-staff `PUT /users/update` | Failed on missing table | Explicit 400 pointing to portal/team tools |
| `/auth/me` staff fields | Metadata-only fallback | Enriched from Cloud SQL profile |

## Still risky / deferred (do not use for staff writes)

| Path | Issue | Recommendation |
| --- | --- | --- |
| `SupabaseUserRepository.*` (`update`, `save`, `addMember`, `findAll`, `delete`, …) | Still talks to missing `public.users` | Leave as legacy; do not call from staff controllers. Replace callers over time. |
| `UserUseCase.updateUser` / `updateTeamMember` / `addMember` / `deleteMember` | Wraps Supabase repo | Prefer `CloudSqlTeamService` at controller edge (already done for primary team routes). |
| `authUseCase.signup` / OAuth profile `save` | May try Supabase `users` upsert | Staff should already exist in Cloud SQL; signup path needs a dedicated follow-up. |
| `createCustomer` → `updateClientStatusToCustomer` | Updates Supabase `users` | Confirm whether still called; migrate to `phi_clients` status if live. |
| Legacy `userController.addMember` (param-style route) | Supabase | Prefer `/clients/team/add` only; consider removing legacy route. |
| Hours APIs under `/users/:id/hours` | Separate domain (often Cloud SQL `hours`) | Spot-check; not the same `public.users` profile bug, but naming is confusing. |

## Verify quickly

```bash
# Staff self update
curl -X PUT localhost:5050/users/update -H "Cookie: ..." -F firstname=Ada -F address='123 Main'

# Staff read-back
curl localhost:5050/auth/me -H "Cookie: ..."
curl localhost:5050/users/<staff-uuid> -H "Cookie: ..."

# Team directory
curl localhost:5050/clients/team/all -H "Cookie: ..."
curl localhost:5050/auth/users -H "Cookie: ..."
```

## Related

- `docs/SECURITY_P0_HARDENING_SUMMARY.md`
- `src/services/cloudSqlTeamService.ts`
- Migration: `src/db/migrations/add_admin_profile_fields.sql`
