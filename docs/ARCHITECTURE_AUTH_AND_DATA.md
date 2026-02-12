# Architecture: Supabase = Auth Only, Cloud SQL = All App Data

## Current design

| Responsibility | System | What lives there |
|----------------|--------|-------------------|
| **Authentication** | **Supabase** | Auth only: sign-in, sign-up, sessions, password reset, OAuth (Google). No app data. |
| **Application data** | **Google Cloud SQL** | Clients, assignments, activities, and all other business data. |

- **Supabase** is used only for **auth** (e.g. `auth.users`, sessions, cookies/tokens). Login validates credentials against Supabase Auth; the backend does not depend on Supabase `public.users` or `client_info` for login.
- **Cloud SQL** is the **single source of truth** for app data when `CLOUD_SQL_HOST` is set. Client list/detail/update, assignments, and activities are read/written there.

## Backend behavior

- **Env:** With `CLOUD_SQL_HOST` set, the backend uses `CloudSqlClientRepository` for all client operations. Without it, client operations still use Supabase (legacy).
- **Login:** `POST /auth/login` → Supabase Auth `signInWithPassword`. User/role can come from auth user metadata when `public.users` is absent.
- **Protected routes:** Same session (cookie or Bearer) is validated with Supabase Auth; then data is loaded from Cloud SQL.

## Summary

- **Supabase = auth only.**  
- **All app data = Google Cloud SQL** (when Cloud SQL is configured).

See also: [CLOUD_SQL_MIGRATION.md](./CLOUD_SQL_MIGRATION.md) for setup and testing.
