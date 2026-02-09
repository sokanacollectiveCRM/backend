# Frontend Auth Alignment Check – AI Prompt

Copy the prompt below and paste it when asking an AI to audit the frontend against the backend auth contract.

---

## Prompt (copy from here)

```
Audit the frontend for auth alignment with this backend. The frontend returns:

  {"error": "No session token provided", "hint": "Provide Cookie or X-Session-Token header"}

### Backend auth contract

The backend accepts session tokens in this order of precedence:
1. Header: `X-Session-Token: <token>`
2. Header: `Authorization: Bearer <token>`
3. Cookie: `sb-access-token=<token>`

### Auth modes

**Cookie mode (default):**
- Login: `POST /auth/login` with `{ email, password }` and `credentials: 'include'`
- Backend responds with `Set-Cookie: sb-access-token=<jwt>; HttpOnly; Secure; SameSite=None`
- All API calls must use `credentials: 'include'` so the browser sends the cookie

**Supabase mode:**
- Login: `supabase.auth.signInWithPassword()` (no backend login)
- All API calls must send `Authorization: Bearer <token>` and/or `X-Session-Token: <token>` where token = `session.access_token` from Supabase

### Checklist – verify these

1. **Auth mode**
   - Where is `VITE_AUTH_MODE` or auth mode decided? Default should be `cookie`.
   - Confirm `src/api/config.ts` (or equivalent) sets `authMode: 'cookie'` when unset.

2. **Login flow**
   - Does login call `POST /auth/login` (cookie mode) or `supabase.auth.signInWithPassword` (supabase mode)?
   - If cookie mode: is `credentials: 'include'` used on the login fetch?

3. **API client**
   - When authMode is `cookie`: does every fetch/axios call use `credentials: 'include'`?
   - When authMode is `supabase`: does every call attach `Authorization: Bearer <token>` (and optionally `X-Session-Token`) from `supabase.auth.getSession()`?

4. **Central HTTP client**
   - Is there a shared `fetch`/`axios` wrapper (e.g. `src/api/http.ts`)?
   - Does it always inject credentials or Bearer token based on auth mode?
   - Are there any direct `fetch()` calls that bypass this wrapper and omit credentials?

5. **/auth/me**
   - How does the app call `GET /auth/me`? Via the central client or raw fetch?
   - If cookie mode: must use `credentials: 'include'`.
   - If supabase mode: must send Bearer or X-Session-Token.

6. **Cross-origin (production)**
   - Frontend and backend are on different origins (e.g. sokanacrm.vercel.app vs crmbackend-six-wine.vercel.app).
   - For cookies: backend must set `SameSite=None; Secure` and CORS must have `credentials: true` and the frontend origin in allowed origins.
   - For Bearer: CORS must allow the frontend origin.

### Common causes of "No session token provided"

- Cookie mode but API calls use `credentials: 'omit'` or no credentials
- Direct `fetch()` calls that don't use the shared HTTP client
- Login never completed (user hit /auth/me before logging in – expected 401)
- Cookie not set: login failed, or `Set-Cookie` blocked (wrong domain/path/SameSite)
- Supabase mode but token not attached: `getSession()` returns null, or token not passed to requests
```

---

## Quick reference: backend expects

| Source        | Header / Cookie         | Example                          |
|---------------|-------------------------|----------------------------------|
| Header        | `X-Session-Token`       | `X-Session-Token: eyJ...`        |
| Header        | `Authorization`         | `Authorization: Bearer eyJ...`   |
| Cookie        | `sb-access-token`       | `Cookie: sb-access-token=eyJ...` |
