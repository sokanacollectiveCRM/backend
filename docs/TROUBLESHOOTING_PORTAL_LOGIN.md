# Troubleshooting Portal Login Issues

## Issue: "Invalid credentials" after setting password

### Root Cause

The login uses Supabase Auth directly (`supabase.auth.signInWithPassword()`), so the password must be saved in Supabase Auth. If you get "Invalid credentials", it means:

1. ❌ Password wasn't actually saved in Supabase Auth
2. ❌ Email/password doesn't match what's in Supabase
3. ❌ User doesn't exist in Supabase Auth (unlikely if invite worked)

### Diagnosis

Check if password is set:
```typescript
// In Supabase Dashboard or via admin API
// Check: Authentication > Users > jerry@jerrybony.me
// Look for "Has Password: Yes/No"
```

### Common Causes

1. **Session not established before password update**
   - The recovery token in URL hash must be processed first
   - Frontend must wait for session before calling `updateUser()`

2. **Token expired or invalid**
   - Recovery tokens expire after 24 hours
   - Token may have been used already

3. **Frontend error not caught**
   - `updateUser()` may have failed silently
   - Check browser console for errors

### Solutions

#### Solution 1: Use Recovery Link Again (Recommended)

1. Get a new recovery link (admin can resend invite)
2. Click the link - should redirect to `/auth/set-password#access_token=...`
3. **Verify session exists** before setting password:
   ```typescript
   // Wait for Supabase to process the hash
   const { data: { session } } = await supabase.auth.getSession();
   if (!session) {
     // Verify token manually
     await supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
   }
   // Then set password
   await supabase.auth.updateUser({ password });
   ```
4. Check for errors in console
5. Verify password was saved

#### Solution 2: Set Password via Supabase Dashboard

1. Go to: https://app.supabase.com
2. Select your project
3. Go to **Authentication** → **Users**
4. Find user: `jerry@jerrybony.me`
5. Click on the user
6. Click **"Reset Password"** or **"Update User"**
7. Set a new password
8. Try logging in again

#### Solution 3: Use Admin API to Set Password

```typescript
// Backend only - requires service role key
await supabase.auth.admin.updateUserById(authUserId, {
  password: 'new-password-here'
});
```

### Frontend Debugging Checklist

When setting password on frontend, verify:

- [ ] Token is extracted from URL hash correctly
- [ ] Session is established before `updateUser()` call
- [ ] `updateUser()` returns success (no error)
- [ ] Browser console shows no errors
- [ ] Network tab shows successful Supabase API call
- [ ] Password meets requirements (min 8 chars, etc.)

### Frontend Code to Verify

```typescript
// In SetPassword component, after form submit:

const handleSetPassword = async (password: string) => {
  // Step 1: Verify session exists
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (!session) {
    console.error('No session - token may be invalid');
    // Try manual verification
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (accessToken) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: accessToken,
        type: 'recovery'
      });

      if (error) {
        setError('Invalid or expired token');
        return;
      }
    } else {
      setError('No access token found');
      return;
    }
  }

  // Step 2: Update password
  const { data, error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) {
    console.error('Password update error:', error);
    setError(error.message);
    return;
  }

  // Step 3: Verify password was set (optional check)
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Password set successfully for:', user?.email);

  setSuccess(true);
};
```

### Verification After Password Set

After setting password, verify it worked:

```typescript
// Check if user can now sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'jerry@jerrybony.me',
  password: 'your-password'
});

if (error) {
  console.error('Login still failing:', error);
} else {
  console.log('✅ Login works!');
}
```

### Quick Test Script

Run this to check if password is set:

```bash
# In backend directory
npx tsx -e "
import supabase from './src/supabase';
const { data } = await supabase.auth.admin.listUsers();
const user = data.users.find(u => u.email === 'jerry@jerrybony.me');
console.log('Has Password:', user?.encrypted_password ? 'Yes' : 'No');
"
```

### Next Steps

1. **Check frontend console** for errors when setting password
2. **Verify session exists** before calling `updateUser()`
3. **Use new recovery link** to try setting password again
4. **Check Supabase Dashboard** to confirm password is saved
5. **Test login** after password is confirmed set
