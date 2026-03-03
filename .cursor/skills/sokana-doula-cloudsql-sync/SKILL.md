---
name: sokana-doula-cloudsql-sync
description: Maintains backend/frontend alignment for Sokana doula workflows using Cloud SQL as source of truth for doulas, clients, assignments, hours, and activities, with Supabase for auth and doula documents. Use when debugging doula dashboard issues, fixing response-shape mismatches, mapping schemas, or implementing doula profile/clients/hours/activities flows across backend and frontend repos.
---

# Sokana Doula Cloud SQL Sync

## Purpose

Use this skill to keep backend and frontend behavior aligned for doula workflows.

Primary goals:
- Ensure Cloud SQL is the operational source of truth for doula dashboard data.
- Keep Supabase limited to auth and doula documents/storage.
- Prevent and fix API response-shape drift between backend and frontend.
- Provide a repeatable debugging workflow for "empty tab" and "not showing data" incidents.

## Source Of Truth Rules

- **Supabase**
  - Auth users/session (`auth.users`, JWT/cookies).
  - Doula documents/storage flow.
- **Cloud SQL (`sokana_private`)**
  - `public.doulas` (doula profile records keyed by auth user id).
  - `public.phi_clients` (client records).
  - `public.doula_assignments` (doula-client relationship).
  - `public.hours` (time logs).
  - `public.client_activities` (activities/notes).

When implementing or debugging, do not move these responsibilities unless explicitly requested.

## Active Contracts To Preserve

### Doula profile
- Backend endpoint: `GET /api/doulas/profile`
- Must resolve auth user, then return profile using Cloud SQL doula row where available.

### Doula clients
- Backend endpoint: `GET /api/doulas/clients`
- Must be driven by `public.doula_assignments` + `public.phi_clients`.

### Doula hours
- Backend endpoints:
  - `POST /api/doulas/hours`
  - `GET /api/doulas/hours`
- Write/read Cloud SQL `public.hours`.
- Request input should accept both:
  - snake_case: `client_id`, `start_time`, `end_time`
  - camelCase: `clientId`, `startTime`, `endTime`
- Response should remain tolerant for frontend:
  - include `start_time` and `startTime`
  - include `end_time` and `endTime`
  - include `client.id`, `client.firstname`, `client.lastname`
  - include legacy fallback `client.user.firstname`, `client.user.lastname`

### Doula activities
- Backend endpoints:
  - `POST /api/doulas/clients/:clientId/activities`
  - `GET /api/doulas/clients/:clientId/activities`
- Use Cloud SQL `public.client_activities`.
- Activities act as notes.

### Doula documents
- Backend endpoint: `GET/POST/DELETE /api/doulas/documents`
- Keep on Supabase.

## Execution Workflow (Backend + Frontend)

1. **Confirm data location**
   - Verify tables in Cloud SQL before changing code.
   - Verify row existence for current doula/client ids.
2. **Trace backend path**
   - Route -> controller -> use case -> repository -> SQL table.
   - Confirm role/assignment checks use `public.doula_assignments`.
3. **Trace frontend path**
   - Tab component -> API service function -> normalization -> UI mapping.
   - Confirm expected response wrapper (`{ success, ... }` vs array).
4. **Patch with compatibility**
   - Prefer adding tolerant parsing and dual field support before removing old shapes.
5. **Validate quickly**
   - Confirm request status codes in logs.
   - Confirm rows inserted/returned in Cloud SQL.
   - Confirm UI displays row and computed totals.
6. **Document deltas**
   - Update `frontend-context.md` in this skill with new contracts once frontend stabilizes.

## Debug Playbook: "Data Saved But Not Showing"

Use this exact order:
- Check backend logs for `POST` status (expect `201`) and follow-up `GET` status (`200`).
- Query Cloud SQL table to confirm inserted row.
- Compare API response body shape to frontend parser assumptions.
- Patch parser normalization first if shape mismatch exists.
- Add no-cache headers for highly dynamic dashboard endpoints when stale `304` behavior appears.

## Guardrails

- Do not revert unrelated local changes.
- Prefer additive compatibility changes for payload shapes.
- Keep auth behavior unchanged unless issue is explicitly auth-related.
- Keep API normalization in service layer, not scattered across components.
- Remove or reduce noisy logs once a flow is stable.

## Files Usually Touched

Backend:
- `src/controllers/doulaController.ts`
- `src/repositories/cloudSqlClientRepository.ts`
- `src/repositories/supabaseUserRepository.ts`
- `src/repositories/cloudSqlActivityRepository.ts`
- `src/services/cloudSqlDoulaAssignmentService.ts`
- `src/db/migrations/*.sql`

Frontend:
- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/components/HoursTab.tsx`
- `frontend-crm/src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `frontend-crm/src/features/doula-dashboard/components/ClientsTab.tsx`
- `frontend-crm/src/features/doula-dashboard/components/DocumentsTab.tsx`

## Update Policy For This Skill

When frontend changes land:
1. Append new response contracts and normalization rules to `frontend-context.md`.
2. Mark deprecated shapes and keep migration notes.
3. Keep this `SKILL.md` stable and concise; move detailed, evolving mappings into reference docs.

## Additional Reference

- See [frontend-context.md](frontend-context.md) for living contract notes and known fragility points.
