# Cross-Repo Handoffs

Use this folder to hand work cleanly between frontend and backend.

## Folders

- `open/` -> active requests waiting for pickup
- `done/` -> completed requests with outcome notes

## Naming

Use:

- `YYYY-MM-DD-backend-<slug>.md` for frontend -> backend
- `YYYY-MM-DD-frontend-<slug>.md` for backend -> frontend

## Rule

Every handoff must include:
- clear direction
- exact requested changes
- acceptance criteria
- verification steps

## Backend Startup Requirement

Before any new backend implementation task:
- check `open/` for frontend-originated tasks
- communicate either:
  - `open_handoff_tasks_found` + file names, or
  - `no_open_handoff_tasks`
