# P-22 implementation (DEV only)

The Oct 21 decision reverses DEC-005 for W-9 and direct deposit. Background
checks are an HR-owned status, never a new upload type.

## Document definitions and views

Backend:

- `src/constants/doulaDocuments.ts`: accepted/retired document types and
  metadata.
- `src/features/doulas/domain/documentPolicy.ts`: canonical requirements
  configuration.
- `src/features/doulas/application/submitDoulaProfile.ts`: submission and
  approval checks.
- `src/features/doulas/http/doulaController.ts`: uploads, owner/admin reads,
  reviews, signed URLs and background status updates.
- `src/repositories/doulaDocumentRepository.ts`: Cloud SQL
  `public.doula_documents` model and persistence.
- `src/db/migrations/create_doula_documents_table_cloudsql.sql`: original table
  model.
- `src/db/migrations/20261025_p22_documents_background_check.sql`: additive P-22
  migration.
- `src/features/doulas/application/backgroundCheck.ts`: server-side HR/payroll
  capability and tenant checks.

Frontend:

- `src/api/doulas/doulaService.ts`: document types, metadata and API mapping.
- `src/domain/documentPolicy.ts`: generated copy of the backend policy, never
  independently configured.
- `src/features/doula-dashboard/components/DocumentsTab.tsx`: doula Documents
  step.
- `src/features/doula-dashboard/components/ProfileTab.tsx`: submission
  readiness.
- `src/features/hours/components/AdminDoulaDocumentsSection.tsx`: admin
  documents view.
- `src/features/teams/teams.tsx`: Review profile & documents dialog.
- `src/common/components/BackgroundCheckStatus.tsx`: status/audit display and
  HR/payroll controls.

## Requirements

Required: training certificate, W-9, direct deposit, background check Cleared.
Optional: liability insurance, Illinois Medicaid certification, CPR, HIPAA,
miscellaneous documents. Legacy license/other records remain accepted and
viewable; historical background-check files remain intact and are restricted to
HR/payroll (no new background upload).

Change only `PROFILE_REQUIREMENTS` in the backend domain policy. Remove an
upload type to make it optional; add a supported type to make it required.
`BACKGROUND_CHECK_REQUIRED` is derived from the single
`background_check_cleared` entry. When present, Not cleared blocks both
submission and approval. When absent, clearance does not block either action.
Sync the generated frontend policy using:

`node scripts/sync-document-policy.cjs /path/to/frontend`

Verify parity with `--check`. Both services must be rebuilt/deployed after a
policy change. Required badges and missing/rejected borders derive from this
policy; optional uploads receive neither required treatment.

## Permission and background status

`public.doula_hr_permissions` is a tenant-scoped capability for an existing
`public.admins` member, with department `hr` or `payroll`. A generic admin or
billing role does not imply this capability. No staff member receives it
automatically. Requests never trust a department, role grant or actor supplied
in JSON or user metadata.

Only a permitted admin in the doula's tenant can PATCH
`/api/admin/doulas/:doulaId/background-check` with `status: cleared` or
`not_cleared`. The API writes the server timestamp, authenticated actor ID, and
an append-only status event in one SQL statement. Initial status is Not cleared
with null date/actor. Doulas see their own status and audit metadata read-only;
attempts to edit it through their profile return 403. Clients and ordinary
admins receive no status data.

W-9/direct deposit are filtered before URL signing, including archived rows and
completeness details. Their signed-URL and review endpoints also enforce the
capability. Historical background-check uploads get the same restriction.
Existing owner access stays available. New routes do not expose these fields to
clients or ordinary admins.

DEV migration/provisioning command (DB operator only, never production):

`npx tsx scripts/dev-env/migrate-p22.ts /path/to/isolated/dev.env [existing-dev-admin-uuid hr|payroll|revoke]`

The script refuses any database except the isolated DEV database/proxy, checks
document preservation, and can grant/revoke the capability for an existing DEV
admin. The application DB role can read capability assignments; it cannot
provision them through a new endpoint.

## Files, review and migration

All types reuse P-02 signature/MIME/extension validation and the exact rejection
message: "That file type isn't supported. Please upload a JPEG, PNG or PDF." The
limit remains 10 _ 1024 _ 1024 bytes (10 MiB), with the existing size message.

Successful upload/replacement, deletion, and metadata changes invalidate
submitted/approved profile reviews and increment the review version. New uploads
are Uploaded, requiring admin review. Changing a document's type resets its
document approval. Replacement stores the new file and row before deleting the
previous one. Existing rows/files are untouched by the migration. Historical
background uploads do not automatically confer clearance.

The migration can be repeated, widens the type check to CPR/HIPAA while
preserving legacy values, and adds status/audit/permission tables without
deleting documents. A PostgreSQL-compatible migration test runs it twice and
verifies all four restored/new types persist and invalidate review.

## Follow-up

P-23: capability enforcement is implemented here. A staff-facing permission
assignment UI and broader role-management rules remain; provisioning is
available to DB operators through the guarded DEV script. See the TODO in
`backgroundCheck.ts`. No default grant was made to all admins. P-24: its
acceptance criteria were not supplied; no separate P-24 behavior is claimed or
implemented by this task.

Validation counts, commit/merge hashes, migration results and DEV revision IDs
are recorded in the delivery report after deployment. All test documents and
added fixture data are fictional.

## Validation before DEV merge

- Backend: 125 suites, 1,019 tests passed.
- Frontend: 75 suites, 859 tests passed.
- P-22 Playwright: 1 test passed, covering all four restored/new uploads and
  reload.
- Both production builds/type checks passed. Policy parity check and
  changed-file formatting passed.
- Full ESLint was run against both changed repos and clean origin/dev baselines:
  backend 165 pre-existing errors; frontend 1,683 pre-existing errors and 133
  warnings. No new ESLint messages were introduced. The backend's existing
  ESLint config checks JavaScript, while TypeScript is type-checked and
  formatted.
