# Frontend Context (Living Reference)

This file is intentionally updateable as frontend work finishes.

## Preflight Entry Checklist

Use this checklist at the top of every new preflight entry:

- **Gate Result**: `run_preflight` or `skip_preflight`
- **Reason**: `preflight_required_every_task`
- **Task Intent**: one line
- **Repos Scanned**: backend/frontend/both
- **Files Scanned**: list of concrete paths
- **Context Updated**: yes/no
- **Implementation Started After Gate**: yes/no

## Repos

- Backend: `/Users/jerrybony/Documents/GitHub/backend`
- Frontend: `/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm`

## Doula Dashboard Map

- Route container: `src/features/doula-dashboard/DoulaDashboard.tsx`
- Tabs:
  - `components/ProfileTab.tsx`
  - `components/DocumentsTab.tsx`
  - `components/ClientsTab.tsx`
  - `components/HoursTab.tsx`
  - `components/ActivitiesTab.tsx`
- Main service: `src/api/doulas/doulaService.ts`

## Auth + Request Transport

- `src/main.tsx` globally wraps `window.fetch` to include credentials for non-Supabase URLs.
- `src/common/contexts/UserContext.tsx` handles backend auth state via `/auth/me`, `/auth/login`, `/auth/logout`.
- Protected routing: `src/common/components/routes/ProtectedRoutes.tsx`.

## Known Response Wrappers To Support

For doula APIs, frontend currently sees multiple wrappers and should tolerate:
- Raw array
- `{ success: true, data: [...] }`
- `{ success: true, clients: [...] }`
- `{ success: true, hours: [...] }`
- `{ success: true, activities: [...] }`
- `{ clients: [...] }`
- `{ hours: [...] }`
- `{ activities: [...] }`
- `{ data: [...] }`

## Hours Contract Notes

Backend currently returns hours through `GET /api/doulas/hours` as:
- Wrapper: `{ success: true, hours: [...] }`
- Entries may contain:
  - `start_time` and `startTime`
  - `end_time` and `endTime`
  - `client.id`, `client.firstname`, `client.lastname`
  - compatibility nested: `client.user.firstname`, `client.user.lastname`

Frontend parser in `src/api/doulas/doulaService.ts` should:
- unwrap wrappers above
- normalize date fields to `startTime`/`endTime`
- compute `hours` if not provided

## Activities Contract Notes

- Endpoint: `GET /api/doulas/clients/:clientId/activities`
- Source: Cloud SQL `public.client_activities`
- Frontend should normalize:
  - `created_at`/`createdAt`
  - `description`/`content`
  - `created_by`/`createdBy`

## Documents Contract Notes

- Endpoint: `/api/doulas/documents`
- Source: Supabase table/storage.
- Missing table in Supabase should degrade gracefully:
  - return empty list and no hard failure in UI.

## Known Fragility

- Duplicate normalization logic exists in both service and components.
- Verbose console logs can obscure real issues.
- Mixed API approaches (centralized service layer vs direct fetch modules) can drift.

## Stabilization Checklist (Update As Work Finishes)

- [ ] Consolidate normalization into shared API mappers.
- [ ] Reduce service/component debug logging after verification.
- [ ] Keep backwards compatibility for payload shapes until all tabs are updated.
- [ ] Add explicit contract tests for `clients`, `hours`, and `activities`.
- [ ] Remove deprecated fields only after frontend rollout confirms parity.

## Preflight Update 2026-03-02

### Task
- Establish a required frontend pre-task scanning workflow skill.

### Files Scanned
- `src/api/doulas/doulaService.ts`
- `src/features/doula-dashboard/components/HoursTab.tsx`
- `src/features/doula-dashboard/components/ClientsTab.tsx`
- `src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `src/features/doula-dashboard/components/DocumentsTab.tsx`
- `src/main.tsx`
- `src/common/contexts/UserContext.tsx`
- `src/common/components/routes/ProtectedRoutes.tsx`
- `src/Routes.tsx`

### Contract Findings
- Doula dashboard relies on service-layer normalization for wrapper and field variance.
- Hours list requires unwrapping `{ success, hours }` and mixed snake/camel field support.

### Drift Risk
- Backend/frontend changes can silently diverge due to mixed API styles and duplicated transforms.

### Required Compatibility
- Preserve wrappers (`data`, `clients`, `hours`, `activities`) and mixed field shapes until consolidation is complete.

### Action
- [x] Context updated
- [x] Preflight skill created

## Preflight Update 2026-03-02 (Cloud SQL doula bio column)

### Gate Result
- `run_preflight`

### Reason
- `preflight_required_every_task`

### Task
- Add `bio` column to Cloud SQL `public.doulas`.

### Files Scanned
- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/components/ProfileTab.tsx`
- `.cursor/skills/sokana-doula-cloudsql-sync/frontend-context.md`

### Contract Findings
- Frontend expects `profile.bio` in both fetch and update profile flows.
- Backend schema currently lacked `public.doulas.bio`, so Cloud SQL could not store profile bio.

### Drift Risk
- Without a Cloud SQL `bio` column, profile parity remains partial and update persistence can drift between layers.

### Required Compatibility
- Add `bio` as nullable text in Cloud SQL with idempotent migration.

### Action
- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-02 (Task command rule set)

### Gate Result
- `run_preflight`

### Reason
- `preflight_required_every_task`

### Task
- Add command-style rule mappings for `task`, `run task`, and `status` in backend workspace.

### Files Scanned
- `.cursor/rules/require-ticket-status-update.mdc`
- `.cursor/rules/require-frontend-preflight-skill.mdc`
- `.cursor/handoffs/open/`

### Contract Findings
- Operational workflow needed explicit command semantics for listing, executing, and reporting handoff tasks.

### Drift Risk
- Without command normalization, task handling behavior can vary between sessions.

### Required Compatibility
- Support command aliases (`tasks`, `list tasks`, `execute task`, `task status`) with consistent behavior.

### Action
- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-02 (Ticket closure + status rule)

### Gate Result
- `run_preflight`

### Reason
- `preflight_required_every_task`

### Task
- Close completed handoff ticket and add rule to always update ticket status after task completion.

### Files Scanned
- `.cursor/handoffs/open/2026-03-02-backend-doula-profile-cloudsql-bio.md`
- `.cursor/rules/require-frontend-preflight-skill.mdc`

### Contract Findings
- Operational process needed enforcement: completed tasks can remain marked open unless explicitly closed and moved.

### Drift Risk
- Open queue can become inaccurate and cause duplicate work if status hygiene is not enforced.

### Required Compatibility
- Standardize completion workflow for handoff/ticket files:
  - status update,
  - checklist update,
  - completion summary,
  - move to closed folder.

### Action
- [x] Context updated
- [x] Implementation started

## Preflight Update 2026-03-02 (Cloud SQL profile field parity)

### Gate Result
- `run_preflight`

### Reason
- `preflight_required_every_task`

### Task
- Execute open handoff for Cloud SQL-first doula profile parity (`bio`, address fields, account status).

### Files Scanned
- `frontend-crm/src/api/doulas/doulaService.ts`
- `frontend-crm/src/features/doula-dashboard/components/ProfileTab.tsx`
- `backend/src/controllers/doulaController.ts`
- `backend/src/services/cloudSqlTeamService.ts`

### Contract Findings
- Frontend profile form expects `bio`, `address`, `city`, `state`, `country`, `zip_code`, `account_status`.
- Backend profile response must remain `{ success, profile }` and tolerate Cloud SQL-only doula records.

### Drift Risk
- If PUT still writes only legacy `users`, Cloud SQL-only doulas fail with `User not found`.
- Missing Cloud SQL columns prevent round-trip persistence for profile fields.

### Required Compatibility
- Cloud SQL-first GET/PUT for doula profile fields.
- Keep profile response compatible with existing frontend parser.

### Action
- [x] Context updated
- [x] Implementation started
