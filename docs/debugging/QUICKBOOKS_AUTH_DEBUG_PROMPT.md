# QuickBooks Auth URL Debug Prompt

## Task
Check if the authentication token is being sent properly when calling the `/quickbooks/auth/url` endpoint. The backend is returning 401 Unauthorized errors, which means either:
1. No token is being sent in the request
2. The token is invalid or expired
3. The token is in the wrong format

## What to Check

1. **Find where the frontend calls `/quickbooks/auth/url`**
   - Search for: `quickbooks/auth/url`, `/quickbooks/auth/url`, or `auth/url`
   - Look for fetch/axios/api calls to this endpoint

2. **Verify the request includes authentication:**
   - Check if `Authorization: Bearer <token>` header is included
   - Check if `session` cookie is being sent (if using cookie-based auth)
   - Verify the token is being retrieved from the auth system (localStorage, cookies, context, etc.)

3. **Check the request configuration:**
   - Ensure `credentials: 'include'` is set if using cookies
   - Verify headers are being set correctly
   - Check if there's an axios interceptor or fetch wrapper that should add the token

4. **Verify token format:**
   - Token should be a valid JWT/session token
   - Should be sent as: `Authorization: Bearer <token>` (with space after "Bearer")
   - Or as a cookie named `session`

5. **Check for CORS issues:**
   - Verify the request includes credentials if needed
   - Check if CORS is blocking the Authorization header

## Expected Request Format

The backend expects one of these:

**Option 1: Authorization Header**
```javascript
fetch('/quickbooks/auth/url', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
```

**Option 2: Session Cookie**
```javascript
fetch('/quickbooks/auth/url', {
  credentials: 'include', // This sends cookies
  headers: {
    'Content-Type': 'application/json'
  }
})
```

## What to Report

1. Where the API call is made (file and function/component)
2. How the token is retrieved (localStorage, context, cookies, etc.)
3. How the token is sent (header, cookie, or not at all)
4. The exact request code/configuration
5. Any interceptors or wrappers that modify requests

## Backend Expectations

The backend auth middleware checks for:
- `req.headers.authorization` (expects `Bearer <token>`)
- `req.cookies.session` (expects session cookie)

If neither is present or valid, it returns 401.
