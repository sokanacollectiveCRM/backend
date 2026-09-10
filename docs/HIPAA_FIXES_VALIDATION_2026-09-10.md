# HIPAA backend fixes — local validation, 2026-09-10

This change restricts organization-wide financial reads to admin/billing,
removes billing and insurance fields from doula client responses, checks account
and client portal disablement on protected requests, and rejects the deprecated
free-text card field on intake and billing updates.

Assignment authorization and active assignment lists now use Cloud SQL.
Unassignment preserves the row with a cancelled status and end timestamp.
Identity Platform profile and role resolution, plus activity author enrichment,
use Cloud SQL. The legacy-schema identity lookup uses contiguous SQL parameters
so PostgreSQL can bind the fallback query correctly.

## Validation

Validation used Node 20.19.2:

- `npm test -- --runInBand`: 82 suites, 587 tests passed.
- `npm run build`: passed.
- `npm run test:security-smoke`: passed.
- CI-scoped ESLint (`src/security`, `src/features`, `src/common/http`): passed.
- Staged-file Prettier and `git diff --check`: passed.

Regression coverage includes financial route denial, minimized doula responses,
legacy card input rejection, assignment denial on database errors, retained
assignment revocation, Cloud SQL identity resolution and its schema fallback,
and immediate client access denial after portal disablement.

## Deployment dependencies and limits

Apply `src/db/migrations/20260906_harden_doula_assignment_lifecycle.sql` before
shipping the assignment queries: they require the new status column. Include
`src/db/migrations/20260907_add_identity_platform_links.sql` for explicit
identity links; the identity resolver supports the older schema during
migration.

These are local code/build tests with mocked database dependencies. This session
did not apply migrations, inspect production, enable staged accounts, send
onboarding messages, or deploy. Supabase exit and the remaining findings in the
implementation audit are separate work. The results do not establish overall
HIPAA readiness.

Operational migration scripts, migration output directories, and previous audit
and migration sign-off drafts are outside this application-fix commit.
