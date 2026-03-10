# Mandatory Doula Documents - Setup Guide

## Overview

Doulas must upload 5 required documents before they can be marked active:
1. Background Check
2. Liability Insurance Certificate
3. Training Certificate
4. W9
5. Direct Deposit Form

## Database Migration

Run the Supabase migration to add new columns and document type support:

```bash
# In Supabase SQL Editor, run:
# src/db/migrations/add_mandatory_doula_documents_schema.sql
```

This adds:
- `reviewed_at`, `reviewed_by`, `rejection_reason` columns
- Document type constraint (includes new required types)
- Index for admin lookups

## Supabase Storage

### Bucket

- **Name**: `doula-documents`
- **Private**: Yes
- **Path pattern**: `{authUserId}/{documentType}/{timestamp}_{sanitizedFilename}`

### Setup

If the bucket does not exist, run:

```bash
# Option 1: Use existing setup script
npx tsx scripts/setup-doula-storage.ts

# Option 2: Run SQL in Supabase SQL Editor
# src/db/migrations/setup_doula_documents_storage.sql
```

### Allowed MIME Types

- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/jpg`

### File Size Limit

- Max 10MB per file

## Environment Variables

No new env vars required. Uses existing:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)

## API Endpoints

### Doula (own documents)

- `GET /api/doulas/documents` - List documents + completeness
- `POST /api/doulas/documents` - Upload (multipart/form-data: file, document_type, notes)
- `DELETE /api/doulas/documents/:documentId` - Delete

### Admin

- `GET /api/admin/doulas/:doulaId/documents` - List doula's documents + completeness
- `PATCH /api/admin/doulas/:doulaId/documents/:documentId/review` - Approve/reject
- `GET /api/admin/doulas/:doulaId/documents/:documentId/url` - Get signed URL

## Active Status Enforcement

When an admin tries to set a doula's `account_status` to `approved` via `PUT /clients/team/:id`, the backend validates that all 5 required documents are uploaded and approved. If not, the request returns 400 with a clear error message.

## RLS / Authorization

- Doulas: can upload, view, delete their own documents
- Admins: can view any doula's documents, approve/reject, get signed URLs

Storage policies use `auth.uid()` for the first path segment. The backend passes the auth user ID when generating upload paths.
