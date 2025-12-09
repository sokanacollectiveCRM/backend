# Admin Invite Doula Endpoint

## Overview
Endpoint for administrators to invite doulas to join the platform. The doula receives an email invitation with a link to create their profile and upload necessary documents.

## Endpoint
**POST** `/api/admin/doulas/invite`

## Authentication
- **Required:** Yes
- **Role:** `admin` only
- **Header:** `Authorization: Bearer <admin_access_token>`

## Request Body
```json
{
  "email": "doula@example.com",
  "firstname": "Jane",
  "lastname": "Doe"
}
```

### Required Fields:
- `email` (string) - Valid email address
- `firstname` (string) - First name of the doula
- `lastname` (string) - Last name of the doula

## Response

### Success (200 OK)
```json
{
  "success": true,
  "message": "Invitation email sent to doula@example.com",
  "data": {
    "email": "doula@example.com",
    "firstname": "Jane",
    "lastname": "Doe",
    "inviteToken": "example_invite_token_abc123xyz"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Fields
```json
{
  "success": false,
  "error": "Missing required fields: email, firstname, and lastname are required"
}
```

#### 400 Bad Request - Invalid Email
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

#### 401 Unauthorized - Not Authenticated
```json
{
  "error": "No session token provided"
}
```

#### 403 Forbidden - Not Admin
```json
{
  "error": "Only administrators can invite doulas."
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to send invitation email"
}
```

## Email Invitation

The doula receives an email with:
- **Subject:** "You're Invited to Join Our Doula Team!"
- **Content:**
  - Personalized greeting with firstname and lastname
  - Invitation to create profile
  - Link to signup page: `${FRONTEND_URL}/signup`
  - Instructions to use the provided email address
  - Professional HTML formatting

## Example Usage

### cURL
```bash
curl -X POST http://localhost:5050/api/admin/doulas/invite \
  -H "Authorization: Bearer <your_admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doula@example.com",
    "firstname": "Jane",
    "lastname": "Doe"
  }'
```

### JavaScript/TypeScript
```typescript
async function inviteDoula(token: string, email: string, firstname: string, lastname: string) {
  const response = await fetch('http://localhost:5050/api/admin/doulas/invite', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      firstname,
      lastname
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to invite doula');
  }

  return data;
}

// Usage
try {
  const result = await inviteDoula(
    adminToken,
    'doula@example.com',
    'Jane',
    'Doe'
  );
  console.log('Invitation sent:', result.message);
} catch (error) {
  console.error('Error:', error.message);
}
```

## Frontend Implementation

### UI Requirements:
1. **Form Fields:**
   - Email input (with validation)
   - First name input
   - Last name input
   - Submit button

2. **Validation:**
   - All fields required
   - Email format validation
   - Show validation errors

3. **Success Handling:**
   - Show success message
   - Clear form
   - Optionally show invite token for tracking

4. **Error Handling:**
   - Display error messages
   - Handle 401/403 errors (redirect to login or show permission error)
   - Handle network errors

### Example React Component:
```tsx
import { useState } from 'react';

function InviteDoulaForm() {
  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken'); // Replace with your actual token storage method
      const response = await fetch('http://localhost:5050/api/admin/doulas/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, firstname, lastname })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite doula');
      }

      setSuccess(data.message);
      setEmail('');
      setFirstname('');
      setLastname('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label>First Name</label>
        <input
          type="text"
          value={firstname}
          onChange={(e) => setFirstname(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Last Name</label>
        <input
          type="text"
          value={lastname}
          onChange={(e) => setLastname(e.target.value)}
          required
        />
      </div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Invitation'}
      </button>
    </form>
  );
}
```

## Testing

The endpoint has been tested and verified. Test results:
- ✅ Admin authentication
- ✅ Role authorization (admin only)
- ✅ Email validation
- ✅ Required fields validation
- ✅ Email sending functionality
- ✅ Success response format

## Notes

1. **Invite Token:** The endpoint generates and returns an invite token. This can be used for:
   - Tracking invitations
   - Analytics
   - Future features (e.g., invitation expiration, resend)

2. **Email Service:** Requires email service configuration (Nodemailer with SMTP settings)

3. **Frontend URL:** The email contains a link to `${FRONTEND_URL}/signup`. Ensure this environment variable is set correctly.

4. **Doula Signup:** After receiving the email, the doula should:
   - Click the signup link
   - Use the exact email address they were invited with
   - Create their account with role "doula"
   - Complete their profile
   - Upload required documents

## Related Endpoints

- **Doula Signup:** `POST /api/auth/signup` (with role="doula")
- **Doula Profile:** `GET /api/doulas/profile`
- **Upload Documents:** `POST /api/doulas/documents`
