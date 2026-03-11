# Backend handoff: Doula documents ID mismatch

## Status: closed

## Summary

There's an **ID mismatch**: documents are stored with the **Supabase auth user id**, but the admin view loads them using the **Cloud SQL doula id**. For some doulas (e.g. info@techluminateacademy.com), those IDs can differ, so the admin sees no documents.

## Proposed fix

When the admin document endpoint finds no documents by Cloud SQL doula id, it should:

1. Look up the doula's email in Cloud SQL
2. Find the Supabase auth user id for that email
3. Fetch documents by that auth user id and return them

## Implementation (completed)

- [x] Added `DoulaDocumentIdResolver` service to resolve Cloud SQL doula id → Supabase auth user id via email
- [x] Updated `getDoulaDocumentsAdmin`: try Cloud SQL id first; if no docs, fallback to auth user id by email
- [x] Updated `reviewDocument` and `getDocumentUrl`: use `isDocumentOwnedByDoula` for ownership check (handles ID mismatch)
- [x] Frontend: No changes required

## Optional quick check

In Supabase, run:

```sql
SELECT doula_id, file_name, document_type FROM doula_documents;
```

In Cloud SQL, run:

```sql
SELECT id, email FROM public.doulas WHERE email = 'info@techluminateacademy.com';
```

If the `doula_id` in `doula_documents` is different from `id` in `doulas`, that confirms the mismatch.
