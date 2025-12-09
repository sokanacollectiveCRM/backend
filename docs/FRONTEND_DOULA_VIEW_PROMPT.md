# Frontend Doula View Implementation Prompt

## Overview
Build a comprehensive Doula Dashboard view that allows doulas to manage their profile, upload documents, view assigned clients, log hours, and track client activities. All endpoints have been tested and verified on the backend.

## Backend API Base URL
```
http://localhost:5050/api
```

## Authentication
All endpoints require authentication via Bearer token:
```
Authorization: Bearer <access_token>
```

---

## 1. Doula Profile Management

### Get My Profile
**Endpoint:** `GET /api/doulas/profile`

**Response:**
```json
{
  "id": "21d3addd-4ff0-42bc-a357-bbe40cdea56c",
  "email": "jerry@techluminateacademy.com",
  "firstname": "Jerry",
  "lastname": "Bony",
  "fullName": "Jerry Bony",
  "role": "doula",
  "address": "",
  "city": "",
  "state": "IL",
  "country": "",
  "zip_code": -1,
  "profile_picture": null,
  "account_status": "pending",
  "business": "",
  "bio": "",
  "created_at": "2025-06-05T17:09:51.797Z",
  "updatedAt": "2025-06-05T17:09:51.797Z"
}
```

### Update My Profile
**Endpoint:** `PUT /api/doulas/profile`

**Request Body:**
```json
{
  "firstname": "Jerry",
  "lastname": "Bony",
  "address": "123 Main St",
  "city": "Chicago",
  "state": "IL",
  "country": "USA",
  "zip_code": "60601",
  "business": "My Doula Practice",
  "bio": "Experienced doula with 5+ years..."
}
```

**UI Requirements:**
- Profile form with editable fields
- Save button to update profile
- Success/error notifications
- Display current profile information

---

## 2. Document Management

### Upload Document
**Endpoint:** `POST /api/doulas/documents`

**Request:** `multipart/form-data`
- `document`: File (PDF, DOC, DOCX, JPG, PNG - max 10MB)
- `document_type`: `"background_check" | "license" | "other"`
- `notes`: Optional string

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "a870a9f8-4269-480a-85c8-175bbb6b5e8f",
    "documentType": "background_check",
    "fileName": "test-document.pdf",
    "fileUrl": "https://...supabase.co/storage/v1/object/public/doula-documents/...",
    "fileSize": 16,
    "mimeType": "application/pdf",
    "uploadedAt": "2025-12-08T20:22:03.155Z",
    "status": "pending",
    "notes": "Test background check document"
  }
}
```

### Get My Documents
**Endpoint:** `GET /api/doulas/documents`

**Response:**
```json
[
  {
    "id": "a870a9f8-4269-480a-85c8-175bbb6b5e8f",
    "documentType": "background_check",
    "fileName": "test-document.pdf",
    "fileUrl": "https://...",
    "fileSize": 16,
    "mimeType": "application/pdf",
    "uploadedAt": "2025-12-08T20:22:03.155Z",
    "status": "pending",
    "notes": "Test background check document"
  }
]
```

### Delete Document
**Endpoint:** `DELETE /api/doulas/documents/:documentId`

**UI Requirements:**
- File upload component with drag-and-drop
- Document type selector (background_check, license, other)
- List of uploaded documents with:
  - Document type badge
  - File name
  - Upload date
  - Status badge (pending, approved, rejected)
  - View/download button
  - Delete button
- Notes field for each document
- File size validation (max 10MB)
- File type validation (PDF, DOC, DOCX, JPG, PNG)

---

## 3. Assigned Clients

### Get My Assigned Clients
**Endpoint:** `GET /api/doulas/clients?detailed=false`

**Query Parameters:**
- `detailed`: `true` | `false` (default: `false`)

**Response (lite):**
```json
[
  {
    "id": "client-id",
    "firstname": "Jane",
    "lastname": "Doe",
    "email": "jane@example.com",
    "phone": "555-1234",
    "dueDate": "2025-03-15",
    "status": "active"
  }
]
```

**Response (detailed):**
```json
[
  {
    "id": "client-id",
    "firstname": "Jane",
    "lastname": "Doe",
    "email": "jane@example.com",
    "phone": "555-1234",
    "dueDate": "2025-03-15",
    "status": "active",
    "address": "123 Main St",
    "city": "Chicago",
    "state": "IL",
    "zipCode": "60601",
    "healthHistory": "...",
    "allergies": "...",
    "hospital": "...",
    // ... more fields
  }
]
```

### Get Assigned Client Details
**Endpoint:** `GET /api/doulas/clients/:clientId?detailed=false`

**UI Requirements:**
- List of assigned clients
- Client card/row with key information
- Click to view detailed client information
- Toggle between lite and detailed views
- Empty state when no clients assigned
- Search/filter functionality (optional)

---

## 4. Hours Logging

### Log Hours
**Endpoint:** `POST /api/doulas/hours`

**Request Body:**
```json
{
  "clientId": "client-id",
  "startTime": "2025-12-08T09:00:00Z",
  "endTime": "2025-12-08T11:00:00Z",
  "note": "Prenatal visit - discussed birth plan"
}
```

**Response:**
```json
{
  "id": "hours-entry-id",
  "client": {
    "id": "client-id",
    "firstname": "Jane",
    "lastname": "Doe"
  },
  "startTime": "2025-12-08T09:00:00Z",
  "endTime": "2025-12-08T11:00:00Z",
  "hours": 2,
  "note": "Prenatal visit - discussed birth plan",
  "createdAt": "2025-12-08T11:30:00Z"
}
```

### Get My Hours
**Endpoint:** `GET /api/doulas/hours`

**Response:**
```json
[
  {
    "id": "hours-entry-id",
    "client": {
      "id": "client-id",
      "firstname": "Jane",
      "lastname": "Doe"
    },
    "startTime": "2025-12-08T09:00:00Z",
    "endTime": "2025-12-08T11:00:00Z",
    "hours": 2,
    "note": "Prenatal visit - discussed birth plan",
    "createdAt": "2025-12-08T11:30:00Z"
  }
]
```

**UI Requirements:**
- Hours logging form with:
  - Client selector (only assigned clients)
  - Start date/time picker
  - End date/time picker
  - Automatic hours calculation
  - Notes textarea
- Hours log table/list showing:
  - Date
  - Client name
  - Start time
  - End time
  - Hours worked
  - Notes
  - Actions (edit/delete if needed)
- Filter by client, date range
- Total hours summary

---

## 5. Client Activities/Notes

### Add Client Activity
**Endpoint:** `POST /api/doulas/clients/:clientId/activities`

**Request Body:**
```json
{
  "type": "note" | "call" | "visit" | "email" | "other",
  "description": "Had a phone call with client about upcoming appointment",
  "metadata": {
    "duration": "15 minutes",
    "topic": "Birth plan discussion"
  }
}
```

**Response:**
```json
{
  "id": "activity-id",
  "clientId": "client-id",
  "type": "call",
  "description": "Had a phone call with client about upcoming appointment",
  "metadata": {
    "duration": "15 minutes",
    "topic": "Birth plan discussion"
  },
  "createdAt": "2025-12-08T14:00:00Z",
  "createdBy": "doula-id"
}
```

### Get Client Activities
**Endpoint:** `GET /api/doulas/clients/:clientId/activities`

**Response:**
```json
[
  {
    "id": "activity-id",
    "clientId": "client-id",
    "type": "call",
    "description": "Had a phone call with client about upcoming appointment",
    "metadata": {
      "duration": "15 minutes",
      "topic": "Birth plan discussion"
    },
    "createdAt": "2025-12-08T14:00:00Z",
    "createdBy": "doula-id"
  }
]
```

**UI Requirements:**
- Activity form with:
  - Activity type selector (note, call, visit, email, other)
  - Description textarea
  - Optional metadata fields (duration, topic, etc.)
- Activity timeline/list showing:
  - Activity type icon/badge
  - Description
  - Date/time
  - Metadata (if any)
- Filter by activity type
- Group by date

---

## 6. Dashboard Layout

### Suggested Structure:
```
┌─────────────────────────────────────────┐
│  Doula Dashboard                        │
├─────────────────────────────────────────┤
│  [Profile] [Documents] [Clients]       │
│  [Hours] [Activities]                  │
├─────────────────────────────────────────┤
│                                         │
│  Main Content Area                     │
│  (Changes based on selected tab)        │
│                                         │
└─────────────────────────────────────────┘
```

### Navigation Tabs:
1. **Profile** - View/edit profile information
2. **Documents** - Upload and manage documents
3. **Clients** - View assigned clients
4. **Hours** - Log and view hours
5. **Activities** - View client activities (when client selected)

---

## 7. Error Handling

All endpoints may return:
- `401 Unauthorized` - Invalid or missing token
- `400 Bad Request` - Validation errors
- `403 Forbidden` - Not authorized (e.g., trying to access unassigned client)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": "Error message here"
}
```

---

## 8. Implementation Notes

1. **Authentication**: Store JWT token in localStorage or secure cookie
2. **File Upload**: Use FormData for document uploads
3. **Date/Time**: Use ISO 8601 format for all date/time fields
4. **Client Selection**: Only show clients that are assigned to the doula
5. **Validation**:
   - File size: max 10MB
   - File types: PDF, DOC, DOCX, JPG, PNG
   - Required fields validation
6. **Loading States**: Show loading indicators during API calls
7. **Success Feedback**: Show success messages after successful operations
8. **Error Feedback**: Display error messages clearly

---

## 9. Example API Service Functions

```typescript
// Example using fetch
const API_BASE = 'http://localhost:5050/api';

async function getDoulaProfile(token: string) {
  const response = await fetch(`${API_BASE}/doulas/profile`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function uploadDocument(token: string, file: File, documentType: string, notes?: string) {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('document_type', documentType);
  if (notes) formData.append('notes', notes);

  const response = await fetch(`${API_BASE}/doulas/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  return response.json();
}

async function getAssignedClients(token: string, detailed = false) {
  const response = await fetch(`${API_BASE}/doulas/clients?detailed=${detailed}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function logHours(token: string, clientId: string, startTime: Date, endTime: Date, note?: string) {
  const response = await fetch(`${API_BASE}/doulas/hours`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clientId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      note
    })
  });
  return response.json();
}

async function addClientActivity(token: string, clientId: string, type: string, description: string, metadata?: any) {
  const response = await fetch(`${API_BASE}/doulas/clients/${clientId}/activities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type,
      description,
      metadata
    })
  });
  return response.json();
}
```

---

## 10. Testing

All endpoints have been tested and verified. Use the test script as reference:
```bash
npm run test:doula
```

The backend is production-ready for the doula view implementation.
