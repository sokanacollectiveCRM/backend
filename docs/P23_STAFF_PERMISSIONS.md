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

Both P-23 migrations and the backend/frontend were deployed to DEV on October
26, 2026. Main and production were unchanged. The staff-permissions migration
preserves existing grants, permits both capabilities per admin, and creates the
audit table. Audit history starts with changes made through this feature. The
HR-role migration preserves existing admin roles.

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

## Manual acceptance — Jerry first, pilot team after his pass

JERRY — TEST FIRST (DEV only; pilot team waits for your pass) DEV login:
https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/login

Setup: use your existing ordinary DEV admin with neither HR nor Payroll
capability. Keep that session in browser profile A. Use profile B for the new HR
account and a separate invited doula account for owner checks. Use a fictional
DEV doula and made-up files. Record the doula name and current background status
before changing it. An invitation/account-setup email IS expected: use a
monitored test inbox. No email is expected merely from an HR/payroll capability
change. No invitation has already been sent by this implementation.

1. Baseline as ordinary admin: open the fictional doula's documents / Review
   profile & documents. Training certificate and optional documents may appear.
   W-9, Direct deposit form, historical Background check uploads and
   background-check status/controls must be absent. Open
   /settings/staff-permissions directly: access denied, no staff roster or
   toggles.

2. Invite HR: open Team > Invite Member. Enter the HR name and a monitored
   email, select “HR — doula profiles, documents and background checks,” then
   Send Invitation. Use hr@sokanacollective.com only if you can receive its
   setup email and it is available; if already in use, use an agreed unused
   monitored test address and record it. Confirm the normal account-setup email
   arrives. Never use an admin account as the HR account.

3. Complete account setup in profile B and sign in through the normal DEV
   login/MFA flow. Expect landing at /hr. The sidebar must offer only Doula
   directory; logout remains available. No clients, billing, contracts, reports,
   inbox, Team or Staff permissions navigation.

4. Search for the fictional doula, select it, and check name/contact/address,
   bio, certifications and account status against the saved profile. Confirm
   client assignments, client notes, hours and financial data are absent.

5. Confirm W-9 and Direct deposit form files are visible and open correctly. If
   a historical Background check file exists, confirm it also opens. If none
   exists, record “no historical upload fixture”; do not create a new Background
   check upload field. Confirm the Background check status and Cleared/Not
   cleared control appear.

6. Select Mark Cleared. Refresh and confirm Cleared, timestamp and recorded
   actor persist. Select Mark Not cleared and verify again. Return to the
   original status when finished. A submitted/approved doula profile returns to
   draft after a background-check change; HR has no profile/document approval,
   upload or delete controls.

7. As HR, directly open /clients, /billing/contracts, /contracts, /team, /inbox,
   /demographics and /settings/staff-permissions. Each must show access denied
   and no restricted data. Engineering check using the HR session: GET
   /api/clients, GET /api/admin/staff-permissions and POST /clients/team/add
   must return 403. Do not submit a real invitation during the denied-API test.

8. Return to the inviting ordinary admin in profile A and refresh the doula
   view. Sensitive files/background status must STILL be hidden; Staff
   permissions must STILL be denied. Inviting HR must not grant the inviter
   HR/payroll access.

9. Check the doula owner session: own files/status remain visible, but
   background-check status is read-only. Check an existing client-portal
   session: no doula HR documents/status or HR workspace is exposed.

10. Jerry engineering audit check: read the DEV staff_permission_events record
    for the newly created HR user. Confirm actor_id = inviting admin, admin_id =
    new HR profile, capability = hr, old_value = false, new_value = true, and a
    server timestamp. The HR user itself cannot open the audit/Staff permissions
    screen.

11. Additional capability regression ONLY with an existing authorized admin
    capability-manager account: grant HR to an existing ordinary DEV admin,
    refresh that target's existing session and confirm sensitive files/status
    appear; revoke it while Payroll is off and confirm they disappear after
    refresh. No logout/login or redeploy is needed and no change email should
    arrive. Confirm Last change shows actor, target, capability, old/new values
    and timestamp. If both grants are on, access remains until both are off.
    Attempt to remove the final HR/payroll holder in an isolated fixture: expect
    the clear rejection, the grant unchanged, and no successful-change audit. If
    no authorized manager/isolated fixture is available, record this subtest as
    Pending; do not treat it as passed or attempt it with the restricted HR
    account.

12. Repeat the HR directory/document view on mobile or a narrow window. Record
    pass/fail by step, browser, account role, fictional doula, expected
    invitation email received, screenshots and errors. If a permission leak
    occurs, record the exact route and stop the pilot handoff. Give
    Nancy/Sonia/Teisha the go-ahead only after your first-pass checks pass; list
    any explicitly pending engineering subtest.

NANCY, SONIA AND TEISHA — AFTER JERRY'S PASS

Nancy: as an ordinary DEV admin, verify HR is available in Team > Invite Member.
Coordinate with Jerry before sending another invite; if an invite is part of
your test, use a new monitored address and expect the setup email. Confirm
ordinary-admin sensitive documents/status and Staff permissions remain
hidden/denied.

Sonia: use the dedicated HR account in a separate browser profile. Open /hr,
search the same fictional doula, confirm limited profile details and W-9/Direct
deposit/historical Background check documents. Change Cleared/Not cleared,
refresh, and verify actor/date persist. Restore the original status.

Teisha: as HR, test the direct routes in step 7 and narrow/mobile layout. As a
separate ordinary admin, confirm /settings/staff-permissions is denied. Confirm
HR has no upload, delete, profile approval or staff-management controls.

Together: repeat the doula-owner read-only status and client-denial checks from
step 9. Record individual pass/fail, browser, screenshots and exact failed
route. Leave manual results unmarked until each tester actually runs them.

## Automated verification

Backend: `npm test -- --runInBand` and `npm run build`. The P-23 SQL fixture
runs the migration twice, preserves existing grants, tests allowed/denied roles
and tenants, both capabilities, no-op saves, last-holder rejection, audit
details, next-request revocation and rollback when audit insertion fails.
Existing P-22 tests cover sensitive document downloads/review and status guards.

Frontend: `npm run test:run`, `npm run build`; screen tests cover grant, revoke,
audit display, denied access and last-holder message. Changed frontend files
pass ESLint.

## Dedicated HR role (confirmed follow-up)

Any ordinary admin may choose **HR — doula profiles, documents and background
checks** in Team > Invite Team Member. This uses the existing account-setup
invitation flow. The account is a dedicated `hr` identity, never a full admin.
Its membership, initial HR grant and capability audit record are created
atomically; failed audit/membership creation rolls back the records and removes
the new Firebase identity. Inviting HR does not grant the inviting admin
sensitive-file access. No invitation was sent as part of
implementation/deployment.

Apply `20261026_p23_hr_role.sql` after the staff-permissions migration before
deploying this follow-up. Existing admin roles remain admin. The dedicated HR
role cannot use the staff-permissions management screen or API, invite
colleagues, or access clients, hours, billing, contracts, reports, inbox or
general staff-management routes. A method/path boundary in authentication denies
HR requests to all authenticated API routes outside the HR workspace, including
older routes that previously checked authentication alone. Role and capability
are loaded from app-managed records on every request; token metadata is ignored.
A stale admin membership cannot promote an HR profile.

HR users land at `/hr`. Navigation contains only Doula directory and logout.
They can search doulas in their organization, read a limited profile
(contact/address, biography, certifications, account status), view documents
including W-9, Direct deposit form and historical Background check uploads, and
set Cleared/Not cleared with the existing timestamp/actor audit. They cannot
upload, delete, approve profiles/documents, change requirements or view client
assignments.

New HR API routes:

- `GET /api/hr/doulas`
- `GET /api/hr/doulas/:doulaId`
- `GET /api/hr/doulas/:doulaId/documents`
- `GET /api/hr/doulas/:doulaId/documents/:documentId/url`
- `PATCH /api/hr/doulas/:doulaId/background-check`

All require a tenant-scoped, persisted HR/Payroll grant. Existing admin holders
retain the original capability-management workflow. Ordinary admins still cannot
open Staff permissions or view sensitive files merely because they can invite
HR.

### Test record

The manual checklist above is the current procedure. The connected Pilot Tasks
sheet carries the same checklist in P-23 and the revised HR instructions in
P-22. No manual result is marked passed by deployment alone.

Additional browser coverage:
`npx playwright test --config=playwright.p23.config.ts` uses fictional
intercepted responses and sends no live invitations.
