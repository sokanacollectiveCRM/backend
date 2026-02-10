# PHI Endpoint Testing Guide

## Overview
Testing guide for the new `PUT /clients/:id/phi` endpoint.

## Endpoint Details

**Endpoint**: `PUT /clients/:id/phi`
**Authorization**: Admin or assigned doula only
**Purpose**: Update ONLY PHI fields in Google Cloud SQL

---

## PHI Fields Accepted

### Identity
- `first_name`
- `last_name`
- `email`
- `phone_number`

### Dates
- `date_of_birth`
- `due_date`

### Address
- `address_line1`
- `address` (alias)
- `city`
- `state`
- `zip_code`
- `country`

### Clinical
- `health_history`
- `health_notes`
- `allergies`
- `medications`

---

## Running Unit Tests

```bash
# Run all tests
npm test

# Run PHI endpoint tests only
npm test clientPhiEndpoint

# Run with coverage
npm test:coverage
```

---

## Manual Testing with curl

### Setup
```bash
# Set your API base URL
export API_URL="http://localhost:3000"  # or your deployed URL

# Get authentication token (adjust based on your auth flow)
export AUTH_TOKEN="your-jwt-token-here"

# Set a valid client ID
export CLIENT_ID="123e4567-e89b-12d3-a456-426614174000"
```

### Test 1: Valid PHI Update (Success Case)
```bash
curl -X PUT "${API_URL}/clients/${CLIENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "first_name": "Jane",
    "last_name": "Doe",
    "phone_number": "555-1234",
    "email": "jane.doe@example.com"
  }'
```

**Expected Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "PHI fields updated successfully"
  }
}
```

---

### Test 2: Reject Non-PHI Fields
```bash
curl -X PUT "${API_URL}/clients/${CLIENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "first_name": "Jane",
    "status": "active",
    "service_needed": "Birth Support"
  }'
```

**Expected Response (400)**:
```json
{
  "success": false,
  "error": "This endpoint only accepts PHI fields. Non-PHI fields not allowed: status, service_needed"
}
```

---

### Test 3: Update Clinical PHI
```bash
curl -X PUT "${API_URL}/clients/${CLIENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "health_history": "No known medical conditions",
    "allergies": "Peanuts, shellfish",
    "medications": "Prenatal vitamins"
  }'
```

**Expected Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "PHI fields updated successfully"
  }
}
```

---

### Test 4: Update Address PHI
```bash
curl -X PUT "${API_URL}/clients/${CLIENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "address_line1": "123 Main Street",
    "city": "Portland",
    "state": "OR",
    "zip_code": "97201",
    "country": "USA"
  }'
```

**Expected Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "PHI fields updated successfully"
  }
}
```

---

### Test 5: Unauthorized Access (Doula not assigned)
```bash
# Use a doula token who is NOT assigned to this client
curl -X PUT "${API_URL}/clients/${CLIENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DOULA_TOKEN}" \
  -d '{
    "first_name": "Jane"
  }'
```

**Expected Response (403)**:
```json
{
  "success": false,
  "error": "Not authorized to update PHI fields"
}
```

---

### Test 6: Invalid Client ID
```bash
curl -X PUT "${API_URL}/clients/invalid-id/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "first_name": "Jane"
  }'
```

**Expected Response (400)**:
```json
{
  "success": false,
  "error": "Invalid client ID format: invalid-id"
}
```

---

### Test 7: Empty Request Body
```bash
curl -X PUT "${API_URL}/clients/${CLIENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{}'
```

**Expected Response (400)**:
```json
{
  "success": false,
  "error": "No fields to update"
}
```

---

### Test 8: Client Not Found
```bash
export NON_EXISTENT_ID="00000000-0000-0000-0000-000000000000"
curl -X PUT "${API_URL}/clients/${NON_EXISTENT_ID}/phi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "first_name": "Jane"
  }'
```

**Expected Response (404)**:
```json
{
  "success": false,
  "error": "Client not found"
}
```

---

## Integration Testing Checklist

- [ ] **Authorization checks**
  - [ ] Admin can update PHI
  - [ ] Assigned doula can update PHI
  - [ ] Unassigned doula cannot update PHI
  - [ ] Client role cannot update PHI

- [ ] **Field validation**
  - [ ] Accepts all PHI fields
  - [ ] Rejects operational fields (status, service_needed, etc.)
  - [ ] Handles camelCase → snake_case normalization
  - [ ] Handles nested user object

- [ ] **PHI Broker integration**
  - [ ] Successfully updates Google Cloud SQL
  - [ ] Identity cache sync works for name/email/phone
  - [ ] No cache sync for non-identity PHI fields

- [ ] **Error handling**
  - [ ] Invalid UUID returns 400
  - [ ] Non-existent client returns 404
  - [ ] Unauthorized access returns 403
  - [ ] Empty body returns 400
  - [ ] PHI Broker errors return appropriate status

- [ ] **Environment mode**
  - [ ] Works in PRIMARY mode
  - [ ] Rejects in shadow/legacy modes

---

## Comparison: PUT /clients/:id vs PUT /clients/:id/phi

| Feature | `PUT /clients/:id` | `PUT /clients/:id/phi` |
|---------|-------------------|----------------------|
| **Accepts PHI fields** | ✅ Yes (auto-split) | ✅ Yes (validated) |
| **Accepts operational fields** | ✅ Yes | ❌ No (rejected) |
| **Updates Supabase** | ✅ Yes | ❌ No (except identity cache) |
| **Updates Cloud SQL** | ✅ Yes (via broker) | ✅ Yes (via broker) |
| **Use case** | General profile update | PHI-only update |
| **Response** | Merged client data | Success message only |

---

## Troubleshooting

### PHI Broker not configured
If `PHI_BROKER_URL` or `PHI_BROKER_SHARED_SECRET` environment variables are not set, the update will be skipped silently.

**Check logs for**:
```
[PhiBroker] Not configured — PHI update skipped
```

### Identity cache write failure
If Supabase identity cache update fails, it's logged as a warning but doesn't block the response:
```
[Client] identity cache write failed (non-blocking)
```

### SPLIT_DB_READ_MODE not set to 'primary'
Endpoint requires `SPLIT_DB_READ_MODE=primary`:
```json
{
  "success": false,
  "error": "Shadow disabled",
  "code": "SHADOW_DISABLED"
}
```

---

## Security Notes

🔒 **HIPAA Compliance**:
- PHI values are NEVER logged
- Only field counts and metadata are logged
- Authorization is checked before PHI access
- Uses HMAC signature for PHI Broker auth

🔍 **Logging**:
- Security warnings logged for unauthorized attempts
- PHI keys stripped from logs (values never logged)
- Source-of-truth instrumentation for audit trails
