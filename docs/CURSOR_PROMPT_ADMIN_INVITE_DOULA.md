# Cursor Prompt: Implement Admin Invite Doula Feature

## Task
Implement a feature in the admin dashboard that allows administrators to invite doulas to join the platform. The admin should be able to enter a doula's email, first name, and last name, and send them an invitation email with a link to create their profile.

## Backend API Endpoint

**POST** `/api/admin/doulas/invite`

**Authentication:** Required (Admin role only)
**Header:** `Authorization: Bearer <admin_access_token>`

**Request Body:**
```json
{
  "email": "doula@example.com",
  "firstname": "Jane",
  "lastname": "Doe"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Invitation email sent to doula@example.com",
  "data": {
    "email": "doula@example.com",
    "firstname": "Jane",
    "lastname": "Doe",
    "inviteToken": "62e7d2ff379b935ceed3ecb32ef6b5cc0b452391b8e3859ac8fd088b224f111e"
  }
}
```

**Error Responses:**
- `400` - Missing required fields or invalid email format
- `401` - Not authenticated
- `403` - Not an admin
- `500` - Server error

## Implementation Requirements

### 1. Create Invite Doula Form Component

**Location:** Create in your admin dashboard/components area

**Features:**
- Form with three fields:
  - Email input (with email validation)
  - First Name input
  - Last Name input
- Submit button
- Loading state during API call
- Success message display
- Error message display
- Form validation (all fields required, valid email format)

**UI/UX:**
- Clean, professional form design
- Clear labels and placeholders
- Real-time validation feedback
- Disable submit button while loading
- Show success message for 3-5 seconds after successful invite
- Clear form after successful submission

### 2. API Service Function

Create or update your API service file to include:

```typescript
async function inviteDoula(email: string, firstname: string, lastname: string): Promise<{
  success: boolean;
  message: string;
  data: {
    email: string;
    firstname: string;
    lastname: string;
    inviteToken: string;
  };
}> {
  const token = getAuthToken(); // Your token retrieval method
  const response = await fetch(`${API_BASE_URL}/admin/doulas/invite`, {
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

  return data;
}
```

### 3. Integration Points

**Where to Add:**
- Add to admin dashboard navigation/menu
- Could be in a "Doulas" or "Team Management" section
- Consider adding to a modal or dedicated page

**Suggested Locations:**
- Admin Dashboard > Doulas > Invite New Doula
- Or: Admin Dashboard > Team > Invite Doula
- Or: Modal triggered from a "Invite Doula" button

### 4. Error Handling

Handle these scenarios:
- **Network errors:** Show user-friendly message
- **401 Unauthorized:** Redirect to login or show "Please log in" message
- **403 Forbidden:** Show "You don't have permission" message
- **400 Validation errors:** Display specific validation messages
- **500 Server errors:** Show generic error message

### 5. Success Flow

After successful invitation:
1. Show success message: "Invitation sent to [email]"
2. Optionally show invite token (for admin tracking)
3. Clear form fields
4. Optionally add to a list of sent invitations (if you have that feature)

### 6. Email Content Preview

The doula will receive an email with:
- Subject: "Welcome to the Sokana Doula Team!"
- Personalized greeting
- Link to signup page: `${FRONTEND_URL}/signup?role=doula&email=${email}&invite_token=${token}`
- Instructions to use the provided email address
- Next steps information

### 7. Example Component Structure

```tsx
// Example React component structure
function InviteDoulaForm() {
  // State management
  // Form validation
  // API call handling
  // Success/error display
  // Form submission
  
  return (
    <form>
      {/* Email input */}
      {/* First name input */}
      {/* Last name input */}
      {/* Submit button */}
      {/* Success message */}
      {/* Error message */}
    </form>
  );
}
```

## Design Considerations

1. **Form Layout:**
   - Use a clean, centered form layout
   - Consider using a card or modal container
   - Add proper spacing and typography

2. **Validation:**
   - Real-time email format validation
   - Show validation errors below each field
   - Disable submit until all fields are valid

3. **Loading States:**
   - Show spinner or loading text on submit button
   - Disable form during submission
   - Prevent multiple submissions

4. **Success Feedback:**
   - Green success message
   - Clear indication that email was sent
   - Optionally show a checkmark icon

5. **Error Feedback:**
   - Red error message
   - Clear, actionable error text
   - Don't hide form on error (allow retry)

## Testing Checklist

- [ ] Form validates required fields
- [ ] Email format validation works
- [ ] Submit button disabled during loading
- [ ] Success message displays correctly
- [ ] Error messages display correctly
- [ ] Form clears after successful submission
- [ ] Handles 401 error (redirects to login)
- [ ] Handles 403 error (shows permission error)
- [ ] Handles network errors gracefully
- [ ] Works with actual API endpoint

## Additional Features (Optional)

1. **Invitation History:**
   - List of sent invitations
   - Show status (sent, accepted, pending)
   - Resend invitation option

2. **Bulk Invite:**
   - Upload CSV with multiple doulas
   - Invite multiple doulas at once

3. **Invitation Status:**
   - Track if doula has accepted invitation
   - Show pending vs. completed invitations

## API Base URL
```
http://localhost:5050/api
```

## Notes

- The endpoint has been tested and verified working
- The invite token is returned but optional for tracking
- The doula will receive an email with a signup link
- The doula must use the exact email address when signing up
- Ensure your frontend signup page handles the `role=doula` and `email` query parameters

## Related Documentation

- See `docs/ADMIN_INVITE_DOULA_ENDPOINT.md` for complete API documentation
- See `docs/FRONTEND_DOULA_VIEW_PROMPT.md` for doula dashboard implementation

