# Production Login Fix (CORS / 401)

If you see **CORS error on `token?grant_type=password`** or **401 on `/auth/me`** in production:

## Root Cause

- Default auth mode is `supabase`: the frontend calls Supabase Auth directly from the browser.
- In production, that Supabase request can be blocked by CORS.
- Use **cookie mode** so login goes through your backend instead.

## Fix

### 1. Frontend (Vercel – sokana-crm-frontend)

In **Vercel → Project → Settings → Environment Variables**, add or update:

| Variable | Value | Environment |
|----------|--------|-------------|
| `VITE_AUTH_MODE` | `cookie` | Production |
| `VITE_API_BASE_URL` | `https://crmbackend-six-wine.vercel.app` | Production |

(Or `VITE_APP_BACKEND_URL` if that is what you use.)

### 2. Backend (Vercel – backend)

In **Vercel → Project → Settings → Environment Variables**, ensure:

| Variable | Value | Environment |
|----------|--------|-------------|
| `FRONTEND_ORIGIN` | `https://sokanacrm.vercel.app` | Production |
| `FRONTEND_URL` | `https://sokanacrm.vercel.app` | Production |
| `NODE_ENV` | `production` | Production |

These allow CORS from your frontend origin.

### 3. Redeploy

Redeploy both the **frontend** and **backend** so env changes apply.

---

## Flow After Fix

1. User submits login → `POST /auth/login` to your backend (no Supabase call from the browser).
2. Backend validates with Supabase and sets `sb-access-token` cookie.
3. `/auth/me` and other API calls send the cookie via `credentials: 'include'`.
4. Backend accepts the cookie and returns the user.

## Verify

1. Open DevTools → Network.
2. Log in from production.
3. Confirm `POST /auth/login` returns 200 and sets `sb-access-token` in response headers.
4. Confirm subsequent `GET /auth/me` includes the cookie and returns 200.
