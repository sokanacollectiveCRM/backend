# Mandatory Doula Documents - Manual QA Checklist

## Pre-requisites
- [ ] Run migration: `add_mandatory_doula_documents_schema.sql` in Supabase
- [ ] Ensure `doula-documents` storage bucket exists (see `setup_doula_documents_storage.sql`)
- [ ] Backend and frontend running

## Doula Experience

### Required Documents Tab
- [ ] A. Doula sees all 5 required document types listed
- [ ] B. Each shows correct label (Background Check, Liability Insurance Certificate, etc.)
- [ ] C. Missing docs show "Missing" status and "Upload" button
- [ ] D. Can upload a PDF for each type (max 10MB)
- [ ] E. Can upload PNG/JPG for each type
- [ ] F. Upload rejects files > 10MB with clear error
- [ ] G. Upload rejects disallowed types (e.g. .doc) with clear error
- [ ] H. After upload, status shows "Uploaded" or "Pending Review"
- [ ] I. Can replace an existing document (Replace button)
- [ ] J. Can view uploaded document (View button opens in new tab)
- [ ] K. Can delete uploaded document
- [ ] L. Rejected docs show rejection reason
- [ ] M. Completeness summary shows X/5 approved
- [ ] N. "Eligible to be active" message when all 5 approved

## Admin Experience

### Doula Detail Page
- [ ] O. Admin sees "Required Documents" section
- [ ] P. Shows X/5 approved and eligibility status
- [ ] Q. Can view each uploaded document (View button)
- [ ] R. Can approve documents pending review
- [ ] S. Can reject documents with optional reason
- [ ] T. Rejection reason displays for doula

## Active Status Enforcement
- [ ] U. Admin cannot set doula to "approved" via team update when docs incomplete
- [ ] V. Error message is clear (lists missing or pending types)
- [ ] W. Admin can set to approved when all 5 docs approved

## Edge Cases
- [ ] X. Existing doulas without docs show incomplete
- [ ] Y. New doulas start with all missing
- [ ] Z. Re-uploading same type replaces cleanly (no duplicates)
