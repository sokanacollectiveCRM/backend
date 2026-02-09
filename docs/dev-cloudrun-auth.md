# Dev Cloud Run Auth — curl / Postman Testing

DEV-only flow for calling the private Cloud Run backend from curl, Postman, or scripts using a session token instead of manually copying cookies.

**Prerequisites:** `ENABLE_DEBUG_ENDPOINTS=true` and `NODE_ENV !== 'production'`

---

## Quick Start

```bash
# 1. Set your Cloud Run URL (replace with your actual URL)
export URL="https://backend-XXXXX-uc.a.run.app"

# 2. Get IAM token (for Cloud Run)
export IAM_TOKEN="$(gcloud auth print-identity-token)"

# 3. Mint session token (admin email/password — DEV only)
export SESSION_TOKEN="$(curl -sS -X POST \
  -H "Authorization: Bearer $IAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_ADMIN_PASSWORD"}' \
  "$URL/debug/session-token" | jq -r '.session_token')"

# 4. Call protected endpoints
curl -sS \
  -H "Authorization: Bearer $IAM_TOKEN" \
  -H "X-Session-Token: $SESSION_TOKEN" \
  "$URL/clients" | jq .
```

---

## Local Testing (no IAM)

For local dev, Cloud Run IAM is not required. Use session token only:

```bash
export URL="http://localhost:5050"

# Mint session token
export SESSION_TOKEN="$(curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_ADMIN_PASSWORD"}' \
  "$URL/debug/session-token" | jq -r '.session_token')"

# Call protected endpoints
curl -sS -H "X-Session-Token: $SESSION_TOKEN" "$URL/clients" | jq .
```

---

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/debug/session-token` | POST | None (body: email, password) | Mint session token (admin only) |
| `/debug/whoami` | GET | Cookie or X-Session-Token | Introspect current auth |
| `/clients` | GET | Cookie or X-Session-Token | List clients |
| `/clients/:id` | GET | Cookie or X-Session-Token | Client detail |
| `/health` | GET | None | Health check |

---

## Session Token Sources

The auth middleware accepts the session token from either:

- **Cookie:** `sb-access-token` (set by `/auth/login`)
- **Header:** `X-Session-Token: <token>`

Header takes precedence. Use the header for curl/Postman.

---

## Gating

Debug endpoints return **404** when:

- `ENABLE_DEBUG_ENDPOINTS` is not `true`, or
- `NODE_ENV` is `production`

Add to `.env` for local testing:

```
ENABLE_DEBUG_ENDPOINTS=true
NODE_ENV=development
```

For Cloud Run, set `ENABLE_DEBUG_ENDPOINTS=true` in the service env vars (and ensure `NODE_ENV` is not `production` if you want debug endpoints).
