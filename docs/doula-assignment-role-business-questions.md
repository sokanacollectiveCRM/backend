# Doula Assignment Role Rollout: Business Questions

This document captures the decisions needed from business before we enforce strict backend rules for doula assignment roles (`primary`, `backup`).

## 1) Default Role For Existing Single Assignments

Question:
- If a client currently has exactly one doula assignment with no role, should it be automatically set to `primary`?

Decision options:
- Yes, auto-set to `primary`.
- No, keep as `unspecified` (null) until manually reviewed.

Why this matters:
- Controls whether legacy data is auto-normalized or manually curated.
- Affects reporting consistency and customer-facing role display.

## 2) Max Role Limits Per Client

Question:
- What hard limit should backend enforce for active assignments per client?

Decision options:
- At most one `primary` and one `backup`.
- At most one `primary`, backups unlimited.
- No strict backend cap yet (frontend guardrails only).

Why this matters:
- Determines DB constraints + API validation behavior.
- Prevents invalid assignment combinations from API or scripts.

## 3) Backup Dependency Rule

Question:
- Should assigning a `backup` require an existing `primary` first?

Decision options:
- Yes, primary must exist before backup.
- No, backup can exist without primary.

Why this matters:
- Changes assignment workflow logic and admin UX expectations.
- Impacts migration handling for legacy records.

## 4) Legacy Clients With Multiple Assignments (No Roles)

Question:
- For clients already assigned to 2+ doulas without roles, should role assignment be manual or automatic?

Decision options:
- Manual review queue for admins (recommended for data accuracy).
- Auto-assign by heuristic (e.g., oldest assignment = primary).

Why this matters:
- Determines migration safety vs. speed.
- Avoids incorrect assumptions in high-impact client relationships.

## 5) What To Do With `unspecified` Going Forward

Question:
- After rollout, should new assignments without an explicit role be allowed?

Decision options:
- No, role required on all new assignments.
- Yes, allow null temporarily during transition window.

Why this matters:
- Defines when we can move from soft rollout to strict enforcement.
- Impacts API contract stability and frontend validation.

## 6) Reassignment And Role Switching Rules

Question:
- If an admin sets a new `primary` while one already exists, what should happen?

Decision options:
- Reject request and require explicit reassignment steps.
- Automatically demote existing `primary` to `backup` if slot available.
- Automatically unset existing `primary` to `unspecified`.

Why this matters:
- Prevents ambiguous overwrite behavior.
- Defines predictable admin operations and audit expectations.

## 7) Unassign Behavior

Question:
- If a `primary` is unassigned, should system auto-promote existing `backup` to `primary`?

Decision options:
- Yes, auto-promote.
- No, keep backup as backup and leave primary empty until manually set.

Why this matters:
- Affects continuity of care assumptions.
- Must align with operational and legal expectations.

## 8) Historical And Audit Requirements

Question:
- Do we need to track role change history (who changed role, from/to, timestamp)?

Decision options:
- Yes, store role-change audit trail.
- No, current assignment row state is sufficient.

Why this matters:
- Determines if additional audit table/events are required.
- Impacts compliance and troubleshooting capabilities.

## 9) Admin Review Queue Requirements

Question:
- Should backend expose a dedicated endpoint/report for clients needing role cleanup?

Decision options:
- Yes, provide query/report of clients with invalid/legacy role states.
- No, handle with ad hoc SQL/admin scripts.

Why this matters:
- Affects operational burden on admins during rollout.
- Supports safer phased migration and verification.

## 10) Rollout And Cutover Policy

Question:
- What is the go-live policy for strict enforcement?

Decision options:
- Enforce immediately after migration.
- Enforce after a grace period with monitoring.
- Enforce per environment or per client cohort.

Why this matters:
- Reduces production risk during transition.
- Aligns backend enforcement timing with frontend flag enablement.

---

## Recommended Baseline (if business wants guidance)

- Enforce max of one `primary` and one `backup` per client.
- Allow `backup` only when a `primary` exists.
- Auto-set single legacy assignment to `primary`.
- Send 2+ legacy untyped assignments to manual admin review queue.
- Require role on all new assignments after cutover date.

