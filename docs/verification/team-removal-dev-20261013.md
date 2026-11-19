# Team invitation and account removal — dev verification

Verified October 13, 2026. Dev API revision: `sokana-private-api-dev-00067-wb4` (100% traffic).
Cloud Build: `9a6424cc-4dee-42f8-82a1-c0ee83acc290`.

Admin `DELETE /clients/team/:id` now delegates to a tenant-scoped removal service:

- Pending invitations: removes the invitation and its event rows. No Firebase account is created or deleted.
- Accepted staff: removes the staff row, membership, and matching invitation history. Deletes the linked Firebase identity if no other account or membership references it.
- Database dependency failures prevent Firebase deletion. Firebase failures roll back database removal. An already-missing Firebase identity is tolerated on retry.
- Dev shares Firebase with production. Newly accepted invitations stamp `sokanaAccountDatabase`. Dev refuses automatic deletion of unmarked or differently owned identities; those need an explicit account review. Shared identities remain when another account references them.

Validation:

- 14 tests passed across removal, team availability, and invitation suites.
- TypeScript compilation passed for the isolated deployment source.
- Prettier passed. Existing ESLint configuration does not match TypeScript files; it reported them ignored, so no TypeScript lint result is claimed.
- Live API: admin removed a pending doula invitation and its events.
- Live API: accepted a fictional admin invitation, verified Firebase creation and dev ownership claim, then removed its account, membership, invitation history, and Firebase identity.
- Live API: removed a fictional doula, its membership and invitation history, and Firebase identity.
- All four temporary fictional fixtures (including the testing admin) were removed and verified absent. No test emails were sent.

The requested test email `jerrybony5@gmail.com` had no remaining invitation or staff row, but retained an orphaned dev membership and Firebase account. Both were deleted after a boolean production account existence check returned false. Firebase lookup then returned zero users for that email.

Deployment used an overlay of three compiled modules on the existing dev image, preserving its configuration and other deployed changes. No production deployment or production data mutation was performed. Source changes are in the local workspace and have not been committed.
