# P-07: existing staff accounts across organizations

An existing login can accept another organization's invitation without creating
another Identity Platform account, changing its password or claims, copying
private profile fields, or modifying the original organization's membership.
Each organization gets a distinct staff profile and membership, linked to the
same Identity Platform UID. Existing-member checks apply to the inviting
organization; pending invitations remain unique per organization and email.

## API contract

- `POST /auth/invitations/preview` with `{ "token": "..." }` returns the
  invitation details and `requiresSignIn`.
- New users accept with `{ "token": "...", "password": "..." }` as before.
- Existing users sign in to their existing account, then accept with
  `{ "token": "...", "idToken": "..." }`, or send the existing authenticated
  session cookie/header/bearer token. Acceptance verifies the token (including
  revocation), UID, invited email, and live account disabled state. It does not
  require membership in the destination organization before acceptance.
- Missing authentication for an existing account returns HTTP 401 with code
  `EXISTING_ACCOUNT_SIGN_IN_REQUIRED`. A different signed-in account returns 403.
- Success includes `requiresEmailVerification` and `organizationName`. Already
  verified accounts need no repeated inbox verification.
- Select an organization with the existing `X-Tenant-Id` header. With isolation
  enforced, multiple active organizations and no selection returns
  `TENANT_SELECTION_REQUIRED`. Authentication uses the shared UID for membership
  lookup, then loads only the selected membership's staff profile and role.

The frontend now consumes `requiresSignIn`, accepts the existing password,
and passes a fresh Firebase ID token without an old session cookie. It then
clears the old session and sends the user through normal MFA sign-in. After MFA,
multiple memberships lead to `/choose-organization`; the choice is checked by
`/auth/me`, stored per tab, and included in authenticated API requests. Switching
organizations performs a full reload to discard prior workspace state.

## Migration and rollout

Apply `src/db/migrations/20261024_multitenant_staff_identity.sql` as the table
owner after the tenancy and staff-invitation foundation migrations, before
rolling out this backend. It replaces global single-column staff email/UID
uniqueness with organization-scoped uniqueness and prevents duplicate staff
memberships within an organization. It is transactional and repeatable.
Legacy global normalized-email and full-name indexes are replaced by tenant-scoped indexes too.
Existing duplicates cause index creation to fail and the migration to roll back;
this change does not merge or delete existing records.

`TENANCY_ENFORCE=on` is required for sharing existing accounts. Acceptance fails
closed when organization isolation is disabled. This change does not enable
that setting or deploy anything. Use the isolated dev stack for rollout.

## Validation

Run ordinary invitation, membership, identity, and middleware regression checks:

```sh
./node_modules/.bin/jest --runInBand \
  src/features/team/__tests__/staffInvitationRoutes.test.ts \
  src/features/team/__tests__/staffInvitation.test.ts \
  src/features/tenancy/__tests__ \
  src/__tests__/multiTenantStaffAuth.test.ts \
  src/__tests__/cloudSqlIdentityUserService.test.ts \
  src/__tests__/teamMemberRemoval.test.ts \
  src/__tests__/authCompatibility.test.ts
./node_modules/.bin/tsc --noEmit
```

Run actual PostgreSQL integration tests (requires local PostgreSQL tools):

```sh
bash scripts/testing/test-multitenant-invitations.sh
```

The script creates and destroys its own local PostgreSQL cluster using a Unix
socket with no TCP listener. The integration suite creates its own database,
uses `app_user` with real enforced row-level security, and applies the actual
migrations. Identity-provider operations and outbound email are mocked. No
production/dev database, live login, or real email is used.

Coverage includes cross-organization acceptance; preservation of the original
profile and membership; existing-member conflicts; correct-account proof;
disabled accounts; invalid sessions; concurrent invites/acceptances; expired
invitations; transaction rollback and shared-login preservation; new-account
provisioning and rollback cleanup; tenant selection; selected profile resolution;
RLS separation; inactive organizations; isolation-disabled rejection; and
migration repeatability and uniqueness.

## Dev database migration result

Applied to `sokana_private_dev` on `sokana-phi-postgres-dev` on October 24, 2026.
Verified tenant-scoped staff email/UID/name indexes and membership uniqueness.
Preflight and postflight both reported zero duplicate groups. No user or
membership records were merged or deleted.

The deployed dev API currently has `TENANCY_ENFORCE` unset. The dev deployment
environment generator now sets it to `on`; a backend/frontend deployment is
still required to activate the feature in the hosted dev app. Production was
not changed.
