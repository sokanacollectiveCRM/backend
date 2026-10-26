# P-23 staff permissions (DEV only)

Frontend route: `/settings/staff-permissions` (Settings > Staff permissions in
the sidebar). Backend routes, behind existing auth/tenant middleware:

- `GET /api/admin/staff-permissions/access`: checks access without returning the
  staff roster.
- `GET /api/admin/staff-permissions`: tenant admin roster, independent
  HR/Payroll values, latest audit event.
- `PATCH /api/admin/staff-permissions/:adminId`:
  `{ "capability": "hr" | "payroll", "enabled": boolean }`.

Only tenant admins with an existing HR/Payroll grant or an app-managed
super-admin flag (`admins.is_super_admin=true` or stored
`admins.role=super_admin/superadmin`) may use these routes. Auth-provider
metadata is never used. The current core admin schema does not itself define a
super-admin role; ordinary admin records gain no extra authority. Existing
HR/Payroll holders can manage grants immediately once the feature and migration
are released. Super-admin status alone does not grant access to sensitive
documents; existing HR/Payroll document guards are unchanged.

Apply `src/db/migrations/20261026_p23_staff_permissions.sql` after P-22 when an
authorized DEV rollout is scheduled. This task only commits/pushes source; it
does not migrate or deploy. The migration preserves grants and changes the
primary key to permit both capabilities per admin, then creates the append-only
audit table and application grants. It is idempotent. Audit history starts with
changes made through this feature; it does not invent events for old operator
grants.

Changes serialize using a database table lock, recheck the actor after taking
the lock, and save the grant/revocation and audit event in the same transaction.
Removing the final HR/Payroll grant to an existing admin in the tenant returns
409 with instructions to grant another admin first. Removing HR while that
person retains Payroll is allowed. Repeated requests for the already-saved value
create no audit event. No mail, notification or outbox service is invoked.

The document guard queries the permission table on every request. Grants and
revocations apply on the next request with the same login session; no logout,
token refresh or redeploy is needed per change. Reload the document view to
update what is already rendered. Previously downloaded files cannot be recalled.
Document types and required-document rules are unchanged.

## Pilot Tasks sheet — Nancy, Sonia and Teisha

Run only after this code and the P-22/P-23 migrations are available in DEV. Use
an existing authorized HR/Payroll manager (or app-managed super admin), one
existing ordinary DEV admin as the target, and a separate ordinary admin for the
denial test. Use separate browser profiles for the manager and target. Keep
another HR/Payroll holder throughout. Use a fictional DEV doula with W-9, Direct
deposit form and historical background-check uploads.

| Tester | Action                                                                                                                                                                                                                                                         | Expected result                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nancy  | As the manager, open Settings > Staff permissions. Find the existing target DEV admin with HR and Payroll both off; turn HR on.                                                                                                                                | HR saves on. Last change shows Nancy's manager account, target admin, HR, Off → On and timestamp. No email/notification is sent.                                                                             |
| Sonia  | In the target admin's existing session, reload that doula's document view.                                                                                                                                                                                     | W-9, Direct deposit form, historical Background check upload and background-check status appear. Background check can be set to Cleared or Not cleared, with actor/date recorded. No logout/login is needed. |
| Nancy  | Turn HR off for the target; leave Payroll off.                                                                                                                                                                                                                 | HR saves off. Last change shows actor, target, HR, On → Off and timestamp. No email/notification is sent.                                                                                                    |
| Sonia  | In the same target session, reload the document view.                                                                                                                                                                                                          | W-9, Direct deposit form, historical Background check upload, background-check status and status-change controls disappear. Requests for their download URLs/status changes are denied.                      |
| Teisha | As an ordinary admin with neither capability, open `/settings/staff-permissions` directly. Also try GET `/api/admin/staff-permissions` and PATCH `/api/admin/staff-permissions/<target-id>` with `{ "capability": "hr", "enabled": true }` using that session. | Sidebar link is absent. Screen shows access denied, no staff roster/checkboxes. Both API requests return 403 and no grant changes.                                                                           |
| Teisha | As manager, attempt to remove the final HR/Payroll grant in the tenant (use an isolated fixture if other holders must remain).                                                                                                                                 | Save is rejected: Cannot remove the last person with HR/payroll access. Grant access to another admin first. Grant remains enabled; no change event is added.                                                |

Repeat the grant/revoke flow with Payroll to verify it independently grants the
same sensitive-document access. If both are on, revoke one and confirm access
persists until both are off. Restore original grants when finished.

## Automated verification

Backend: `npm test -- --runInBand` and `npm run build`. The P-23 SQL fixture
runs the migration twice, preserves existing grants, tests allowed/denied roles
and tenants, both capabilities, no-op saves, last-holder rejection, audit
details, next-request revocation and rollback when audit insertion fails.
Existing P-22 tests cover sensitive document downloads/review and status guards.

Frontend: `npm run test:run`, `npm run build`; screen tests cover grant, revoke,
audit display, denied access and last-holder message. Changed frontend files
pass ESLint.
