# Frontend: Portal Set Password & Client Login Pages

## Overview

Implement two pages for client portal authentication:

1. **Set Password Page** (`/auth/set-password`) - Where clients set their
   password after receiving the invite email
2. **Client Login Page** (`/auth/client-login`) - Separate login page for
   clients (different from admin/doula login)

## Context

When an admin invites a client to the portal:

- An email is sent from `hello@sokanacollective.com` with a "Set Your Password"
  link
- The link redirects to `/auth/set-password#access_token=...` (Supabase recovery
  token in URL hash)
- After setting password, client should be redirected to the client login page
- Clients have a separate login flow from admins/doulas

## Page 1: Set Password Page

### Route

`/auth/set-password`

### URL Format

```
http://localhost:3001/auth/set-password#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `access_token` is in the URL hash (after `#`), not query params.

### Requirements

1. **Extract Access Token**

   - Read `access_token` from URL hash (`window.location.hash`)
   - Parse the hash: `#access_token=TOKEN&type=recovery&...`
   - Handle case where token is missing or invalid

2. **Password Form**

   - Two password fields: "Password" and "Confirm Password"
   - Password requirements (display to user):
     - Minimum 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
   - Show/hide password toggle
   - Real-time password strength indicator (optional but recommended)
   - Validation:
     - Passwords must match
     - Must meet requirements
     - Show clear error messages

3. **Supabase Integration**

   - Use Supabase client to update password
   - Call: `supabase.auth.updateUser({ password: newPassword })`
   - The access token from URL should already be in the session after redirect
   - OR use:
     `supabase.auth.verifyOtp({ token_hash: accessToken, type: 'recovery' })`
     then update password

4. **User Experience**

   - Loading state while processing
   - Success message after password is set
   - Error handling with user-friendly messages
   - Auto-redirect to client login page after success (3-5 seconds)
   - Manual "Go to Login" button

5. **Error Handling**
   - Invalid/expired token → Show error, offer to request new invite
   - Network errors → Retry option
   - Password validation errors → Show inline errors

### Implementation Notes

**Important:** Yes, `supabase.auth.updateUser({ password })` works even if the
user doesn't have a password yet! The recovery token establishes a session,
allowing password creation.

**Supabase Auth Flow (Recommended):**

When the user clicks the invite link, Supabase automatically handles the hash
and establishes a session. You can then directly update the password:

```typescript
// Step 1: Supabase automatically processes the hash when the page loads
// The access_token in the URL hash establishes a session automatically

// Step 2: Check if session exists (token was processed)
const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

if (!session) {
  // Token might be invalid or expired
  // Try manual verification
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');

  if (accessToken) {
    // Verify the recovery token manually
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: accessToken,
      type: 'recovery',
    });

    if (error) {
      // Token invalid or expired
      throw new Error('Invalid or expired token. Please request a new invite.');
    }
  } else {
    throw new Error('No access token found in URL.');
  }
}

// Step 3: Update password (works even if user has no password yet)
const { data, error } = await supabase.auth.updateUser({
  password: newPassword,
});

if (error) {
  // Handle error (expired token, weak password, etc.)
  // Common errors:
  // - "New password should be different from the old password" (if password exists)
  // - "Password should be at least 6 characters"
  // - "Token has expired or is invalid"
} else {
  // Success - password set! Redirect to login
  router.push('/auth/client-login');
}
```

**Alternative: Simpler Flow (If Supabase auto-handles hash):**

```typescript
// Supabase client automatically processes the hash on page load
// Just wait a moment for session to be established, then update password

useEffect(() => {
  const checkSession = async () => {
    // Wait a bit for Supabase to process the hash
    await new Promise((resolve) => setTimeout(resolve, 500));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setTokenValid(true);
    } else {
      setError('Invalid or expired token');
    }
  };

  checkSession();
}, []);

// When user submits password form:
const handleSetPassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    setError(error.message);
  } else {
    setSuccess(true);
    // Redirect to login after 3 seconds
    setTimeout(() => router.push('/auth/client-login'), 3000);
  }
};
```

**Key Points:**

- ✅ `updateUser({ password })` works for users without passwords (first-time
  password set)
- ✅ The recovery token in the URL hash establishes a session automatically
- ✅ Once session is established, you can set the password
- ✅ No need to verify token separately if Supabase auto-processes the hash

### UI/UX Guidelines

- **Design**: Match your existing auth pages (signup/login) for consistency
- **Branding**: Use Sokana Collective colors/branding
- **Accessibility**:
  - Proper form labels
  - ARIA attributes
  - Keyboard navigation
  - Screen reader friendly
- **Mobile Responsive**: Must work on mobile devices
- **Loading States**: Show spinner/loading indicator during password update

### Example Component Structure

```typescript
// pages/auth/set-password.tsx or app/auth/set-password/page.tsx

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Extract token from URL hash
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (!accessToken) {
      setError('Invalid or missing access token. Please request a new invite.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation
    // Update password via Supabase
    // Handle success/error
  };

  return (
    <div className="set-password-container">
      {/* Form with password fields, validation, submit button */}
    </div>
  );
}
```

---

## Page 2: Client Login Page

### Route

`/auth/client-login`

### Requirements

1. **Login Form**

   - Email field
   - Password field
   - "Remember me" checkbox (optional)
   - "Forgot Password?" link
   - Submit button

2. **Supabase Authentication**

   - Use `supabase.auth.signInWithPassword({ email, password })`
   - Verify user role is 'client' (check user metadata or database)
   - Redirect based on role:
     - Client → Client dashboard/portal
     - Admin/Doula → Show error (use different login page)

3. **User Experience**

   - Loading state during login
   - Error messages for invalid credentials
   - Success redirect to client portal/dashboard
   - "Don't have an account?" link (if applicable)

4. **Role Verification**

   - After successful login, check user role
   - If not 'client', show error: "This login is for clients only. Please use
     the admin/doula login."
   - Redirect admins/doulas to appropriate login page

5. **Session Management**
   - Store session in Supabase (handled automatically)
   - Redirect to client portal if already logged in
   - Handle session expiration

### Implementation Notes

**Login Flow:**

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  // Handle error (invalid credentials, etc.)
} else {
  // Verify role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (userData?.role !== 'client') {
    // Sign out and show error
    await supabase.auth.signOut();
    setError('This login is for clients only.');
  } else {
    // Redirect to client portal
    router.push('/client/dashboard');
  }
}
```

**Alternative: Check from auth metadata**

```typescript
// If role is stored in user_metadata
if (data.user.user_metadata?.role !== 'client') {
  await supabase.auth.signOut();
  setError('This login is for clients only.');
}
```

### UI/UX Guidelines

- **Design**: Distinct from admin/doula login (different colors/styling if
  needed)
- **Branding**: Sokana Collective branding
- **Accessibility**: Same as set password page
- **Mobile Responsive**: Must work on mobile
- **Error Messages**: Clear, user-friendly (don't reveal if email exists)

### Example Component Structure

```typescript
// pages/auth/client-login.tsx or app/auth/client-login/page.tsx

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Login via Supabase
    // Verify role
    // Redirect or show error
  };

  return (
    <div className="client-login-container">
      {/* Login form */}
    </div>
  );
}
```

---

## Integration Points

### Backend API (Already Implemented)

The backend portal invite endpoints are ready:

- `POST /api/admin/clients/:id/portal/invite` - Send invite
- `POST /api/admin/clients/:id/portal/resend` - Resend invite
- `POST /api/admin/clients/:id/portal/disable` - Disable portal access

### Supabase Client Setup

Ensure your frontend has Supabase client configured:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
FRONTEND_URL=http://localhost:3001
```

---

## User Flow

1. **Admin invites client** → Email sent with "Set Your Password" link
2. **Client clicks link** → Redirected to `/auth/set-password#access_token=...`
3. **Client sets password** → Password updated in Supabase Auth
4. **Success** → Redirected to `/auth/client-login` (or auto-login and redirect
   to portal)
5. **Client logs in** → Enters email/password
6. **Success** → Redirected to client portal/dashboard

---

## Error Scenarios to Handle

### Set Password Page

- ❌ Missing or invalid access token
- ❌ Expired token (24 hour expiry)
- ❌ Weak password (doesn't meet requirements)
- ❌ Network error during password update
- ❌ Token already used

### Client Login Page

- ❌ Invalid email/password
- ❌ User not found
- ❌ Account disabled (portal_status = 'disabled')
- ❌ Wrong role (admin/doula trying to use client login)
- ❌ Network error
- ❌ Session expired

---

## Testing Checklist

- [ ] Set password page loads with valid token
- [ ] Set password page shows error with invalid/missing token
- [ ] Password validation works (requirements, matching)
- [ ] Password update succeeds
- [ ] Redirect to login page after success
- [ ] Client login page loads
- [ ] Login succeeds with correct credentials
- [ ] Login fails with wrong credentials
- [ ] Role verification works (blocks non-clients)
- [ ] Redirect to client portal after login
- [ ] Mobile responsive on both pages
- [ ] Error messages are user-friendly
- [ ] Loading states work correctly

---

## Additional Features (Optional)

1. **Password Strength Meter**: Visual indicator of password strength
2. **Auto-login**: After setting password, automatically log in and redirect to
   portal
3. **Remember Me**: Store session longer if checked
4. **Forgot Password**: Link to password reset flow
5. **Resend Invite**: Option for admin to resend invite if token expires
6. **Session Check**: Redirect to portal if already logged in

---

## Files to Create

### Next.js App Router

- `app/auth/set-password/page.tsx`
- `app/auth/client-login/page.tsx`

### Next.js Pages Router

- `pages/auth/set-password.tsx`
- `pages/auth/client-login.tsx`

### Shared Components (Optional)

- `components/auth/PasswordInput.tsx` - Reusable password input with show/hide
- `components/auth/PasswordStrength.tsx` - Password strength indicator
- `components/auth/FormError.tsx` - Error message display

---

## Notes

- The access token in the URL hash is a Supabase recovery token, valid for 24
  hours
- After setting password, the user should be able to log in normally
- The client login is separate from admin/doula login for security and UX
- Consider adding rate limiting on the frontend (max login attempts)
- Ensure proper error logging for debugging production issues
