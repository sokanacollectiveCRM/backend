# P-02: JPEG, PNG and PDF document uploads

Verified on 2026-10-24 against isolated copies of the dev branches. No main or
production changes.

## Upload inventory and behavior

| Field/path                                           | Result                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Doula training certificate                           | JPEG/JPG, PNG, PDF; portal and legacy admin editor                                             |
| Liability insurance certificate                      | JPEG/JPG, PNG, PDF                                                                             |
| Illinois Medicaid certification                      | JPEG/JPG, PNG, PDF                                                                             |
| Miscellaneous documents                              | JPEG/JPG, PNG, PDF; includes CPR, HIPAA or ID documents where needed                           |
| License and Other                                    | Same policy at API/service boundaries; no dedicated portal slots                               |
| Insurance/Medicaid card front and back               | JPEG/JPG, PNG, PDF                                                                             |
| W-9, direct deposit form, background check           | Already retired on dev. Existing records and downloads retained; retirement rules unchanged    |
| Profile pictures/account avatars                     | Independent image validator, unchanged: JPEG, PNG, WebP; 5 MiB                                 |
| Intake branding/logo and intake image-answer uploads | Purpose-specific image fields with independent validators, unchanged                           |
| Contract template authoring                          | DOCX source templates required by the template engine, unchanged; not a profile document field |

No dedicated CPR, HIPAA or ID slots exist on the current dev branch. They can
use Miscellaneous documents. No fields or retired onboarding requirements were
reintroduced.

## Validation and display

All active profile document uploads require a case-insensitive
.jpg/.jpeg/.png/.pdf extension, a matching supplied MIME, and matching file
bytes (JPEG/PNG/PDF signatures). Renamed plain-text PDF files, conflicting
extensions/MIME, GIF, Word and executable extensions are rejected. Storage
metadata uses the detected canonical MIME.

The document limit remains **10 MiB = 10,485,760 bytes**. Frontend, backend
controllers, upload services and Multer enforce the limit. Profile pictures
remain 5 MiB = 5,242,880 bytes.

The field error is: "That file type isn't supported. Please upload a JPEG, PNG
or PDF." Portal, insurance front/back and admin certificate errors appear beside
the field with accessible alert/invalid attributes. Backend rejections also
appear inline.

Admin document previews and Review profile & documents render images inline and
PDFs in the browser viewer, including uppercase extensions. Existing signed-URL
downloads preserve bytes and filenames. No third-party viewer receives private
document URLs.

The legacy admin picker previously sent unsupported multipart profile updates.
It now saves profile data as JSON and sends one training certificate separately
through the existing admin-protected team route. Uploads require an admin, a
tenant and a doula in that tenant, then use the same certificate
replacement/review flow as the portal.

## Security and existing risks

- Private GCS prefixes, signed URL rules, authentication, role gates and storage
  access settings remain unchanged. No bucket policy changes were needed. GCS
  has no application MIME allowlist here; the API enforces the policy before
  private storage writes.
- Invalid documents are rejected before looking up/deleting replacement
  documents or writing storage. Service-level checks also protect non-HTTP
  callers.
- No virus scanner was found in these upload paths. Format-signature validation
  is content-type detection, not antivirus scanning or a guarantee against
  embedded active content inside a valid PDF.
- Existing replacement code deletes the previous certificate before the new
  storage write completes. A storage failure can therefore lose the previous
  file. This pre-existing ordering is unchanged.
- All added fixtures are locally generated fictional documents. No real client
  or doula data was used.

## Verification

- Frontend: **783 tests passed in 73 files** (`npm run test:run`).
- Backend: **927 tests passed in 121 suites** (`npm test -- --runInBand`);
  security smoke **3 passed**.
- Both production builds pass. Backend full TypeScript check passes.
- Frontend all-source TypeScript check has **22 existing errors**, identical to
  untouched dev. Production build type checking passes. The all-source
  comparison uses the repository compiler options with the broken project
  reference omitted; the ordinary root check also reports pre-existing
  project-reference TS6305 errors.
- Full frontend browser suite: **174 passed, 28 failed, 7 skipped, 5 did not
  run**, 214 total. **27 failures also fail on untouched dev**; the remaining
  mobile word-wrap test passes when repeated on both copies. Untouched dev full
  run: 155 passed, 41 failed, 7 skipped, 11 did not run. Failures cover existing
  review/intake/notes fixtures and missing email-verification environment. These
  unrelated failures were not rewritten as part of P-02.
- Full frontend lint remains red with **1,824 errors and 134 warnings**
  (untouched dev: 1,885 errors and 135 warnings). Changed files have **zero lint
  errors**; new files have zero warnings.
- Full backend lint after build reports generated dist JavaScript errors as well
  as existing script formatting issues. Excluding generated dist yields **165
  existing errors**, identical to untouched dev. The existing ESLint config does
  not parse TypeScript; all changed TypeScript files pass the configured
  Prettier check and the compiler.

Acceptance tests cover each active document category, both card sides and admin
certification: each supported format, uppercase extensions, rejected extensions,
disguised plain text, MIME/extension mismatch, size limits, inline
frontend/backend error display, both preview surfaces and admin tenant/role
isolation.
