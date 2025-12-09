# Doula Documents Storage Setup Guide

## Issue
Document uploads are failing with: `new row violates row-level security policy`

## Solution

### Step 1: Create Storage Bucket

1. Go to **Supabase Dashboard** > **Storage**
2. Click **New bucket**
3. Configure:
   - **Name**: `doula-documents`
   - **Public**: `No` (Private bucket)
   - **File size limit**: `10MB`
   - **Allowed MIME types**: 
     - `application/pdf`
     - `image/jpeg`
     - `image/png`
     - `image/jpg`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### Step 2: Set Up RLS Policies

Run the SQL migration in Supabase SQL Editor:

```sql
-- File: src/db/migrations/setup_doula_documents_storage.sql
```

Or manually create these policies in **Storage** > **doula-documents** > **Policies**:

#### Policy 1: Doulas can upload their own documents
- **Policy name**: `Doulas can upload their own documents`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'doula-documents'`
- **WITH CHECK expression**: 
  ```sql
  bucket_id = 'doula-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
  ```

#### Policy 2: Doulas can view their own documents
- **Policy name**: `Doulas can view their own documents`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'doula-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
  ```

#### Policy 3: Doulas can delete their own documents
- **Policy name**: `Doulas can delete their own documents`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'doula-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
  ```

#### Policy 4: Admins can manage all doula documents
- **Policy name**: `Admins can manage all doula documents`
- **Allowed operation**: `ALL`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'doula-documents' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
  ```
- **WITH CHECK expression**: Same as USING

### Step 3: Verify Setup

Run the setup script:
```bash
npx tsx scripts/setup-doula-storage.ts
```

Or verify manually:
1. Check bucket exists: **Storage** > **doula-documents**
2. Check policies: **Storage** > **doula-documents** > **Policies**
3. Test upload: Run `npm run test:doula`

### Step 4: Test

After setup, test the document upload:
```bash
npm run test:doula
```

The upload test should now pass.

## Troubleshooting

### Error: "Bucket not found"
- Create the bucket manually in Supabase Dashboard
- Or run: `npx tsx scripts/setup-doula-storage.ts`

### Error: "new row violates row-level security policy"
- Ensure RLS policies are set up correctly
- Verify the user's token is being passed correctly
- Check that `auth.uid()` matches the doula's user ID

### Error: "Service role key not bypassing RLS"
- Storage RLS works differently than table RLS
- Use the user's access token for uploads (already implemented)
- Service role fallback is available but may not work for storage

## File Path Structure

Documents are stored with this structure:
```
doula-documents/
  {doula_id}/
    {document_type}/
      {timestamp}_{filename}
```

Example:
```
doula-documents/
  21d3addd-4ff0-42bc-a357-bbe40cdea56c/
    background_check/
      1736123456789_test-document.pdf
```

