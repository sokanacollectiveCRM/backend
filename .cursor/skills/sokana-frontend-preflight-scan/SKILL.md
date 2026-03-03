---
name: sokana-frontend-preflight-scan
description: Runs a mandatory pre-task scan of frontend-crm and updates shared context before every task. Use for any backend task to keep frontend/backend context aligned.
---

# Sokana Frontend Preflight Scan

## Purpose

Use this skill to prevent backend/frontend drift for every task.

Run this skill when a task touches:
- Doula dashboard behavior
- API response/request contracts
- Auth/session transport behavior
- Any endpoint consumed by `frontend-crm`

This skill runs for all tasks, including UI-only changes, to keep a consistent preflight record.

## Mandatory Startup Gate (Handoff Inbox)

Before starting any new backend task:
1. Check `.cursor/handoffs/open/` in backend repo.
2. Identify open `frontend->backend` tasks.
3. Communicate status explicitly:
   - `open_handoff_tasks_found: <file list>` or
   - `no_open_handoff_tasks`.
4. If open tasks exist, pick them up first unless user explicitly asks to defer.

## Repositories

- Backend: `/Users/jerrybony/Documents/GitHub/backend`
- Frontend: `/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm`

## Required Preflight (Run Every Task)

1. Scan frontend files relevant to the task (components + API service + route context).
2. Cross-check backend contracts.
3. Identify frontend response-shape assumptions and drift risk.
4. Update:
   - `.cursor/skills/sokana-doula-cloudsql-sync/frontend-context.md`
5. Only then start implementation edits.

If no context changes are needed, add a short “No changes needed” note with date in `frontend-context.md`.

## Cross-Repo Capability (Mandatory For Integration Tasks)

When running from backend workspace:
- Read frontend directly at:
  - `/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm`

When running from frontend workspace:
- Read backend context directly at:
  - `/Users/jerrybony/Documents/GitHub/backend/.cursor/skills/sokana-doula-cloudsql-sync/SKILL.md`
  - `/Users/jerrybony/Documents/GitHub/backend/.cursor/skills/sokana-doula-cloudsql-sync/frontend-context.md`

If a task requires edits in the other repo, perform cross-repo edits in that repo path instead of guessing.

## Scan Targets (Minimum)

Always inspect these when the task is doula dashboard-related:
- `src/api/doulas/doulaService.ts`
- `src/features/doula-dashboard/DoulaDashboard.tsx`
- `src/features/doula-dashboard/components/HoursTab.tsx`
- `src/features/doula-dashboard/components/ClientsTab.tsx`
- `src/features/doula-dashboard/components/ActivitiesTab.tsx`
- `src/features/doula-dashboard/components/DocumentsTab.tsx`

Inspect these when auth/routing/request behavior may affect task:
- `src/main.tsx`
- `src/common/contexts/UserContext.tsx`
- `src/common/components/routes/ProtectedRoutes.tsx`
- `src/Routes.tsx`

## Update Template

Use this structure when updating `frontend-context.md`:

```md
## Preflight Update YYYY-MM-DD

### Task
- <one-line task intent>

### Files Scanned
- <path 1>
- <path 2>

### Contract Findings
- <actual wrapper/field assumptions in frontend>

### Drift Risk
- <what can break if backend/frontend change independently>

### Required Compatibility
- <payload fields/wrappers that must be supported now>

### Action
- [ ] Context updated
- [ ] Implementation started
```

## Decision Rules

- If frontend parser already handles wrapper variants, prefer backend consistency plus minimal frontend normalization.
- If frontend relies on legacy fields, add backward compatibility first, then deprecate later.
- For dynamic dashboard endpoints, consider no-cache behavior to avoid stale/304 artifacts.
- Keep normalization centralized in API service layer, not duplicated across components.

## Output Expectations For Agent

Before implementation, report:
- gate result: `run_preflight`
- Which frontend files were scanned
- What contract assumptions were found
- What was added/changed in `frontend-context.md`
- The specific compatibility strategy for this task

## Related Skill

- Use with: `.cursor/skills/sokana-doula-cloudsql-sync/SKILL.md`
