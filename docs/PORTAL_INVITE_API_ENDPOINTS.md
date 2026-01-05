# Portal Invite API Endpoints

## Overview

This document lists all API endpoints needed for the client portal invite feature, including existing backend endpoints and any additional endpoints needed for password setting.

---

## Existing Backend Endpoints (Already Implemented)

### 1. Invite Client to Portal

**Endpoint:** `POST /api/admin/clients/:id/portal/invite`

**Description:** Admin-only endpoint to invite a client to the portal. Checks eligibility (signed contract + completed first payment), creates Supabase auth user, and sends invite email via Nodemailer.

**Authentication:** Required (Admin only)

**Request:**
```http
POST /api/admin/clients/52a2c584-1725-4aa1-90d9-e6509f059559/portal/invite
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "ok": true,
  "lead": {
    "id": "52a2c584-1725-4aa1-90d9-e6509f059559",
    "portal_status": "invited",
    "invited_at": "2026-01-05T13:23:53.678Z",
    "last_invite_sent_at": "2026-01-05T13:23:53.678Z",
    "invite_sent_count": 1,
    "invited_by": "7e0a278c-3208-4698-a3d5-23b81ead31da",
    "auth_user_id": "be52d479-da07-4735-a4c1-d060cf08d55b"
  }
}
```

**Response (Error - 409 Not Eligible):**
```json
{
  "ok": false,
  "error": {
    "code": "NOT_ELIGIBLE",
    "message": "Invite available after contract is signed and first payment is completed."
  }
}
```

**Response (Error - 429 Rate Limited):**
```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit: Please wait 120 seconds before sending another invite"
  }
}
```

---

### 2. Resend Portal Invite

**Endpoint:** `POST /api/admin/clients/:id/portal/resend`

**Description:** Admin-only endpoint to resend a portal invite. Same eligibility and rate limit checks as invite.

**Authentication:** Required (Admin only)

**Request:**
```http
POST /api/admin/clients/52a2c584-1725-4aa1-90d9-e6509f059559/portal/resend
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Response:** Same format as invite endpoint

---

### 3. Disable Portal Access

**Endpoint:** `POST /api/admin/clients/:id/portal/disable`

**Description:** Admin-only endpoint to disable a client's portal access.

**Authentication:** Required (Admin only)

**Request:**
```http
POST /api/admin/clients/52a2c584-1725-4aa1-90d9-e6509f059559/portal/disable
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "ok": true,
  "lead": {
    "id": "52a2c584-1725-4aa1-90d9-e6509f059559",
    "portal_status": "disabled",
    "invited_at": "2026-01-05T13:23:53.678Z",
    "last_invite_sent_at": "2026-01-05T13:23:53.678Z",
    "invite_sent_count": 1,
    "invited_by": "7e0a278c-3208-4698-a3d5-23b81ead31da",
    "auth_user_id": "be52d479-da07-4735-a4c1-d060cf08d55b"
  }
}
```

---

## Frontend Supabase Auth Calls (No Backend Endpoint Needed)

### 1. Set Password (Frontend Only)

**No backend endpoint needed** - This is handled directly by Supabase Auth on the frontend.

**Supabase Method:** `supabase.auth.updateUser()`

**Implementation:**
```typescript
// After extracting access_token from URL hash
const { data, error } = await supabase.auth.updateUser({
  password: newPassword
});

if (error) {
  // Handle error (expired token, weak password, etc.)
  console.error('Password update error:', error);
} else {
  // Success - password set
  // Redirect to login page
}
```

**Alternative Flow (if token needs verification first):**
```typescript
// Extract token from URL hash
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const accessToken = hashParams.get('access_token');
const type = hashParams.get('type'); // Should be 'recovery'

// Verify token and set password
const { data, error } = await supabase.auth.verifyOtp({
  token_hash: accessToken,
  type: 'recovery'
});

if (!error) {
  // Token verified, now update password
  await supabase.auth.updateUser({ password: newPassword });
}
```

---

### 2. Client Login (Frontend Only)

**No backend endpoint needed** - This is handled directly by Supabase Auth on the frontend.

**Supabase Method:** `supabase.auth.signInWithPassword()`

**Implementation:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
});

if (error) {
  // Handle error (invalid credentials, etc.)
  console.error('Login error:', error);
} else {
  // Verify user role is 'client'
  // Then redirect to client portal
}
```

---

## Optional Backend Endpoints (Recommended)

### 1. Verify Portal Token/Status

**Endpoint:** `GET /api/clients/portal/verify`

**Description:** Verify if a client's portal invite token is valid and check portal status. Useful for the set password page to verify token before showing the form.

**Authentication:** Optional (can use token from URL hash)

**Request:**
```http
GET /api/clients/portal/verify?token=<access_token>
```

**Response (Valid Token - 200):**
```json
{
  "ok": true,
  "valid": true,
  "client": {
    "id": "52a2c584-1725-4aa1-90d9-e6509f059559",
    "email": "jerry@jerrybony.me",
    "portal_status": "invited",
    "invited_at": "2026-01-05T13:23:53.678Z"
  }
}
```

**Response (Invalid/Expired Token - 400):**
```json
{
  "ok": false,
  "valid": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token is invalid or has expired"
  }
}
```

**Implementation Note:** This endpoint would verify the Supabase recovery token and return client info if valid.

---

### 2. Get Client Portal Status

**Endpoint:** `GET /api/clients/me/portal-status`

**Description:** Get the current portal status for the authenticated client. Useful for checking if portal access is enabled.

**Authentication:** Required (Client only)

**Request:**
```http
GET /api/clients/me/portal-status
Authorization: Bearer <client_access_token>
```

**Response (200):**
```json
{
  "ok": true,
  "portal_status": "active",
  "invited_at": "2026-01-05T13:23:53.678Z",
  "last_login_at": "2026-01-05T14:30:00.000Z"
}
```

**Response (Disabled - 403):**
```json
{
  "ok": false,
  "error": {
    "code": "PORTAL_DISABLED",
    "message": "Portal access has been disabled"
  }
}
```

---

### 3. Request New Invite Link

**Endpoint:** `POST /api/clients/me/request-invite`

**Description:** Allow clients to request a new invite link if their token expired. This would trigger a resend (if admin allows self-service).

**Authentication:** Required (Client only)

**Request:**
```http
POST /api/clients/me/request-invite
Authorization: Bearer <client_access_token>
Content-Type: application/json
```

**Response:**
```json
{
  "ok": true,
  "message": "New invite link has been sent to your email"
}
```

**Note:** This is optional - you may want to keep invite resends admin-only for security.

---

## Summary

### Backend Endpoints (Already Implemented ✅)
1. `POST /api/admin/clients/:id/portal/invite` - Invite client
2. `POST /api/admin/clients/:id/portal/resend` - Resend invite
3. `POST /api/admin/clients/:id/portal/disable` - Disable access

### Frontend Supabase Calls (No Backend Needed)
1. `supabase.auth.updateUser({ password })` - Set password
2. `supabase.auth.signInWithPassword({ email, password })` - Client login
3. `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })` - Verify token (optional)

### Optional Backend Endpoints (Recommended)
1. `GET /api/clients/portal/verify` - Verify token validity
2. `GET /api/clients/me/portal-status` - Get portal status
3. `POST /api/clients/me/request-invite` - Request new invite (optional)

---

## Implementation Priority

**Must Have:**
- ✅ Backend invite endpoints (already done)
- Frontend Supabase calls for password setting and login

**Nice to Have:**
- Token verification endpoint
- Portal status check endpoint

**Optional:**
- Self-service invite request endpoint

---

## Testing Endpoints

### Test Invite Endpoint
```bash
# Login as admin first
curl -X POST http://localhost:5050/api/admin/clients/52a2c584-1725-4aa1-90d9-e6509f059559/portal/invite \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

### Test Resend
```bash
curl -X POST http://localhost:5050/api/admin/clients/52a2c584-1725-4aa1-90d9-e6509f059559/portal/resend \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

### Test Disable
```bash
curl -X POST http://localhost:5050/api/admin/clients/52a2c584-1725-4aa1-90d9-e6509f059559/portal/disable \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```
