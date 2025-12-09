# Doula Management Endpoints Testing Guide

This guide explains how to test all the doula management endpoints that were implemented.

## Prerequisites

1. **Database Migration**: Run the migration to create the `doula_documents` table:
   ```sql
   -- Run in Supabase SQL Editor
   -- File: src/db/migrations/create_doula_documents_table.sql
   ```

2. **Supabase Storage Bucket**: Create a storage bucket for doula documents:
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('doula-documents', 'doula-documents', false)
   ON CONFLICT (id) DO NOTHING;
   ```

3. **Test Users**: You need at least:
   - One admin user
   - One doula user
   - One client user (for assignment testing)

4. **Environment Variables**: Set these in your `.env` file (optional - defaults are set):
   ```env
   TEST_ADMIN_EMAIL=admin@test.com
   TEST_ADMIN_PASSWORD=admin123
   TEST_DOULA_EMAIL=jerry@techluminateacademy.com
   TEST_DOULA_PASSWORD=@Bony5690
   BACKEND_URL=http://localhost:5050
   ```

   **Note:** The test scripts use these defaults if env vars are not set.

## Testing Methods

### Method 1: Automated TypeScript Test Script (Recommended)

The comprehensive test script tests all endpoints automatically:

```bash
npm run test:doula
```

Or directly:
```bash
npx tsx scripts/test-doula-endpoints.ts
```

**What it tests:**
- ✅ Admin login
- ✅ Doula login
- ✅ Admin invite doula
- ✅ Upload document
- ✅ Get my documents
- ✅ Get my clients
- ✅ Get client details
- ✅ Log hours
- ✅ Get my hours
- ✅ Add client activity
- ✅ Get client activities
- ✅ Get my profile
- ✅ Update my profile
- ✅ Delete document

### Method 2: Simple Bash Script

For quick endpoint verification:

```bash
./scripts/test-doula-endpoints-simple.sh
```

### Method 3: Manual Testing with curl

#### 1. Get Authentication Tokens

**Admin Login:**
```bash
curl -X POST http://localhost:5050/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

**Doula Login:**
```bash
curl -X POST http://localhost:5050/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jerry@techluminateacademy.com","password":"@Bony5690"}'
```

Save the tokens from the responses.

#### 2. Test Admin Endpoints

**Invite Doula:**
```bash
curl -X POST http://localhost:5050/api/admin/doulas/invite \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newdoula@test.com",
    "firstname": "Jane",
    "lastname": "Doe"
  }'
```

#### 3. Test Doula Document Endpoints

**Upload Document:**
```bash
curl -X POST http://localhost:5050/api/doulas/documents \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "document_type=background_check" \
  -F "notes=Test background check"
```

**Get My Documents:**
```bash
curl -X GET http://localhost:5050/api/doulas/documents \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

**Delete Document:**
```bash
curl -X DELETE http://localhost:5050/api/doulas/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

#### 4. Test Client Access Endpoints

**Get My Clients:**
```bash
curl -X GET http://localhost:5050/api/doulas/clients \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

**Get Client Details:**
```bash
curl -X GET http://localhost:5050/api/doulas/clients/CLIENT_ID \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

#### 5. Test Hours Logging

**Log Hours:**
```bash
curl -X POST http://localhost:5050/api/doulas/hours \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "CLIENT_ID",
    "start_time": "2025-01-15T10:00:00Z",
    "end_time": "2025-01-15T12:00:00Z",
    "note": "Client consultation"
  }'
```

**Get My Hours:**
```bash
curl -X GET http://localhost:5050/api/doulas/hours \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

#### 6. Test Activity Endpoints

**Add Client Activity:**
```bash
curl -X POST http://localhost:5050/api/doulas/clients/CLIENT_ID/activities \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "note_added",
    "description": "Client called to discuss birth plan",
    "metadata": {
      "category": "birth_planning",
      "contactMethod": "phone"
    }
  }'
```

**Get Client Activities:**
```bash
curl -X GET http://localhost:5050/api/doulas/clients/CLIENT_ID/activities \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

#### 7. Test Profile Endpoints

**Get My Profile:**
```bash
curl -X GET http://localhost:5050/api/doulas/profile \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN"
```

**Update My Profile:**
```bash
curl -X PUT http://localhost:5050/api/doulas/profile \
  -H "Authorization: Bearer YOUR_DOULA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Experienced doula with 10 years of practice",
    "phone_number": "555-1234"
  }'
```

### Method 4: Using Postman or Insomnia

1. Import the following collection structure:

**Admin Endpoints:**
- `POST /api/admin/doulas/invite` (Admin only)

**Doula Endpoints:**
- `POST /api/doulas/documents` (File upload)
- `GET /api/doulas/documents`
- `DELETE /api/doulas/documents/:documentId`
- `GET /api/doulas/clients`
- `GET /api/doulas/clients/:clientId`
- `POST /api/doulas/hours`
- `GET /api/doulas/hours`
- `POST /api/doulas/clients/:clientId/activities`
- `GET /api/doulas/clients/:clientId/activities`
- `GET /api/doulas/profile`
- `PUT /api/doulas/profile`

2. Set up environment variables:
   - `base_url`: `http://localhost:5050`
   - `admin_token`: (from admin login)
   - `doula_token`: (from doula login)

3. Add Authorization header: `Bearer {{doula_token}}` or `Bearer {{admin_token}}`

## Expected Responses

### Success Responses

**Upload Document:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "documentType": "background_check",
    "fileName": "document.pdf",
    "fileUrl": "https://...",
    "fileSize": 12345,
    "uploadedAt": "2025-01-15T10:00:00Z",
    "status": "pending"
  }
}
```

**Get My Clients:**
```json
{
  "success": true,
  "clients": [
    {
      "id": "uuid",
      "user": {
        "firstname": "John",
        "lastname": "Doe",
        "email": "john@example.com"
      },
      "status": "active"
    }
  ]
}
```

**Log Hours:**
```json
{
  "success": true,
  "workEntry": {
    "id": "uuid",
    "doula_id": "uuid",
    "client_id": "uuid",
    "start_time": "2025-01-15T10:00:00Z",
    "end_time": "2025-01-15T12:00:00Z"
  }
}
```

### Error Responses

**Unauthorized (401):**
```json
{
  "error": "Unauthorized"
}
```

**Forbidden - Client Not Assigned (403):**
```json
{
  "error": "You can only log hours for clients assigned to you"
}
```

**Not Found (404):**
```json
{
  "error": "Client not found"
}
```

## Common Issues and Solutions

### Issue: "Unauthorized" errors
**Solution:** Make sure you're using a valid JWT token and it's in the Authorization header as `Bearer TOKEN`

### Issue: "You do not have access to this client"
**Solution:** The client must be assigned to the doula via the assignments table. Use the admin endpoint to assign a client first.

### Issue: Document upload fails
**Solution:**
1. Check that the `doula-documents` bucket exists in Supabase Storage
2. Verify the bucket permissions allow uploads
3. Check file size (max 10MB)

### Issue: "Failed to upload document"
**Solution:**
1. Verify Supabase Storage is configured correctly
2. Check that the service role key has storage permissions
3. Ensure the file path format is correct

## Testing Checklist

- [ ] Database migration run successfully
- [ ] Storage bucket created
- [ ] Admin user exists and can login
- [ ] Doula user exists and can login
- [ ] Admin can invite doula
- [ ] Doula can upload document
- [ ] Doula can view their documents
- [ ] Client is assigned to doula (via admin)
- [ ] Doula can view assigned clients
- [ ] Doula can view client details
- [ ] Doula can log hours for assigned client
- [ ] Doula can view their hours
- [ ] Doula can add activities for assigned client
- [ ] Doula can view client activities
- [ ] Doula can view their profile
- [ ] Doula can update their profile
- [ ] Doula can delete their documents
- [ ] Unauthorized access is blocked
- [ ] Assignment validation works (can't access unassigned clients)

## Next Steps

After testing:
1. Review the test results
2. Fix any issues found
3. Test with real data
4. Set up production environment
5. Configure proper security policies
