# Organization membership removal and return

Remove Member revokes only membership in the selected organization. It does not
delete the platform sign-in identity, organization profile, uploaded documents,
review history, or memberships in other organizations. The active Team roster
hides removed profiles; the organization retains the historical profile and
document IDs. Removal creates a membership audit event with organization,
profile, actor and server timestamp. Repeated removal does not create duplicate
events.

The existing `DELETE /clients/team/:id` route is retained for compatibility; its
operation is now membership deactivation. It is still admin-only. No
account-deletion endpoint has been introduced. Removing an HR/payroll holder
also revokes/audits those capabilities in that organization and protects the
final holder. Removal sends no email.

## Invitations

New platform users keep the existing invitation/password-setup flow. When the
email already has a platform account, Team > Invite Member sends a one-time
organization invitation instead of attempting to recreate or reset the account.
Pending invitations appear in Team. An invitation does not grant an existing
account access before acceptance.

The recipient opens the invitation, signs in with the existing password, and
accepts. The backend verifies the recipient's identity and consumes the
invitation atomically. The existing password is never sent to the application's
invitation-accept API or changed. Expired/replayed invitations and a different
signed-in identity cannot restore membership. Failed acceptance rolls back the
profile, membership and audit updates; it never deletes an existing sign-in
identity.

Returning to the same organization restores its retained profile ID and
documents. The doula profile returns to draft for renewed review; previous
document/status history stays with the original organization. Inviting into a
different organization creates a new organization profile with no copied profile
details or documents. A role change for a retained profile requires a separate
authorized process; reinvitation does not silently change its role.

## Organization isolation

The selected organization is sent as `X-Tenant-Id`, checked against current
memberships on every authenticated request, and used to load the correct
organization profile ID and role. The browser offers organization selection when
multiple memberships are active and Switch organization in the account menu.
Switching reloads the workspace so previous organization state is discarded. A
stale selected membership is cleared on the next authentication refresh,
allowing remaining memberships to resolve.

Explicitly inactive memberships are denied even when the legacy tenancy rollout
flag is off. A user with no remaining memberships keeps their platform login and
sees a no-active-membership screen rather than organization data. They can
accept a later invitation with that same login.

Document uploads and lookups use the selected organization's profile. Documents
are never copied, reassigned, or shared across organizations by removal,
invitation or acceptance. Existing HR/payroll visibility guards and document
requirements remain unchanged. Removing access prevents issuing new download
URLs; previously downloaded files cannot be recalled, and previously issued
signed URLs keep their existing expiry.

## DEV rollout

Apply `src/db/migrations/20261026_organization_membership_lifecycle.sql` after
the P-23 migrations. It preserves profile, membership and document data; adds
lifecycle auditing and invitation support; and ensures email/identity uniqueness
is organization-scoped. It does not migrate or copy any uploaded file. Main and
production are outside this release.

## Jerry tests first

Use DEV only and separate browser profiles for the administrator and doula. Use
monitored test addresses where invitation emails are expected, and fictional
profile/documents. Do not remove a real organization's member to run this test.

1. Prepare one doula login with active memberships in test organizations A and
   B. Give each organization a separate, visibly named fictional W-9/document.
   Record profile IDs, existing document names and review status. Use a
   different fictional biography in each organization.
2. Sign in as the doula and choose A, then B. Confirm only that organization's
   profile and documents appear. Do not expect any file to transfer when
   switching.
3. As A's admin, use Team > Remove. Confirm the dialog says the platform login,
   other memberships and historical records are retained. Confirm the member
   disappears from A's active Team list.
4. In the doula's existing session, request A's protected API: expect 403 on the
   next request. Reload: A must not be offered as an active membership. B must
   remain usable with its original profile and documents.
5. As an authorized A staff/HR user, verify A's historical document records and
   stored file references remain attached to A's original profile. As B staff,
   attempt an A document URL endpoint: expect denial and no new signed URL.
6. As A's admin, invite the same email again as Doula. Expect one organization
   invitation email. Confirm the invitation is pending and A access is still
   denied before acceptance. It must not require resetting the platform
   password.
7. Accept with that email's existing platform password in the doula browser
   profile. Sign in normally. Confirm A returns as a membership, its original
   profile ID and A-only documents return, and profile review is draft. B's data
   must remain unchanged. Replay the invitation: expect rejection.
8. Invite the same login into a third test organization C. Accept the
   invitation. Confirm a new profile ID and no A/B biography, document or
   background-check status copied into C. Upload a fictional C document; confirm
   it appears only in C.
9. In an isolated fixture, remove all remaining memberships. Confirm the
   platform login still works but only the no-active-organization message is
   shown. Direct organization API requests remain denied. A later invitation
   must work with the same password.
10. Engineering checks: verify removed/reinstated/joined membership audit
    records have the correct organization, profile, actor and timestamp; verify
    removal did not delete the Firebase identity or any document row/file. Test
    last-HR-holder rejection separately with an isolated fixture.
11. Record pass/fail, organizations and fictional account used, browser, exact
    failed route and screenshots. Nancy, Sonia and Teisha repeat only after
    Jerry's pass. This is no longer a fresh-account reset test: use an unused
    monitored email when testing new-user onboarding from scratch.

## Automated checks

`npm test -- --runInBand` and `npm run build` in backend. The real SQL fixture
applies the migration twice, exercises shared-login removal and existing-session
denial, restores the same organization, joins a new organization with no copied
documents, verifies cross-organization document URL rejection, and tests
wrong-identity/replay/audit rollback behavior without live accounts or emails.

`npm run test:run`, `npm run build` and
`npx playwright test --config=playwright.memberships.config.ts` in frontend.
Tests cover existing-password invitation acceptance without password forwarding,
session-scoped organization headers, organization choice, revoked-selection
fallback, isolated document display and the no-membership screen. Browser
fixtures use made-up data and send no live emails.
