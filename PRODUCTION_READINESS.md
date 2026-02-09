# Production Readiness Guide

This document covers feature flags, environment variables, Cloud Run deployment, and PHI boundary verification for the split-db (PHI vs non-PHI) backend.

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_STRIPE` | `false` | Enable Stripe payment processing. When `false`, Stripe routes are not mounted and `STRIPE_SECRET_KEY` is not required. |
| `FEATURE_QUICKBOOKS` | `false` | Enable QuickBooks integration. When `false`, QuickBooks and customers routes are not mounted; QB env vars are not required. |
| `FEATURE_EMAIL` | `false` | Enable email (SMTP) sending. When `false`, SMTP vars are not required. |
| `ENABLE_DEBUG_ENDPOINTS` | — | Only honored when `NODE_ENV !== "production"`. Enables `/debug` routes for local testing. **Never enabled in production.** |

---

## Required Environment Variables

### Always Required

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for backend operations |
| `PHI_BROKER_URL` | PHI Broker base URL (sokana-private) |
| `PHI_BROKER_SECRET` or `PHI_BROKER_SHARED_SECRET` | HMAC secret for PHI Broker requests |
| `FRONTEND_ORIGIN` | Comma-separated CORS origins (e.g. `https://app.example.com`) |

### Required When `FEATURE_STRIPE=true`

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | (Optional) For Stripe webhook signature verification |

### Required When `FEATURE_EMAIL=true`

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP configuration for transactional email |

### Required When `FEATURE_QUICKBOOKS=true`

| Variable | Purpose |
|----------|---------|
| `QB_CLIENT_ID` | QuickBooks OAuth client ID |
| `QB_CLIENT_SECRET` | QuickBooks OAuth client secret |
| `QB_REDIRECT_URI` | QuickBooks OAuth redirect URI |

---

## Deployment Scripts

### Docker Build (linux/amd64)

```bash
docker buildx build --platform linux/amd64 -t gcr.io/PROJECT_ID/backend:latest .
```

### Run Locally (production-like)

```bash
NODE_ENV=production PORT=8080 npm start
```

### Test Health (no external deps)

```bash
curl http://localhost:8080/health
# Expect: {"status":"ok","service":"sokana-private-api","timestamp":"..."}
```

---

## Cloud Run Deployment

### Deploy (Authenticated)

1. **Require IAM invoker** so only authorized services can call the API:

   ```bash
   gcloud run deploy backend \
     --image gcr.io/PROJECT_ID/backend:latest \
     --platform managed \
     --region us-central1 \
     --no-allow-unauthenticated
   ```

2. **Set environment variables** via Secret Manager (recommended) or Cloud Run env:

   ```bash
   gcloud run services update backend \
     --set-env-vars "NODE_ENV=production,PORT=8080,FEATURE_STRIPE=false,FEATURE_QUICKBOOKS=false"
   ```

   For secrets:

   ```bash
   gcloud run services update backend \
     --set-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-key:latest,PHI_BROKER_SECRET=phi-broker-secret:latest"
   ```

3. **Listening configuration**

   - Host: `0.0.0.0` (default)
   - Port: `PORT` (default `8080`)

   Cloud Run injects `PORT=8080` automatically.

---

## Testing

### Health Check (no auth required for Cloud Run internal)

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://YOUR-SERVICE-URL/health
```

Expected:

```json
{ "status": "ok", "service": "sokana-private-api", "timestamp": "..." }
```

### Clients List (Supabase token required)

```bash
curl -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
  https://YOUR-SERVICE-URL/clients
```

### Verify PHI Boundaries

1. **List endpoint (`GET /clients`)**  
   - Must return only operational fields (no PHI).  
   - In production, any PHI keys in the response are stripped and a security warning is logged (values never logged).

2. **Detail endpoint (`GET /clients/:id`)**  
   - Returns operational-only if requester is not authorized for PHI.  
   - If authorized (admin or assigned doula), PHI is merged from the PHI Broker.

3. **Update endpoint (`PUT /clients/:id`)**  
   - Uses `splitClientPatch` to separate operational vs PHI.  
   - Operational fields → Supabase.  
   - PHI fields → PHI Broker (403 if requester not authorized for PHI).

---

## Security

- **CORS** origins are locked to `FRONTEND_ORIGIN` (and localhost in non-production).
- **helmet** is applied for basic HTTP hardening.
- **x-powered-by** is disabled.
- **Logging** redacts: Authorization header, cookies, PHI fields.
- **Debug routes** (`/debug/*`) are never mounted in production.
- **Cookie auth** is disabled in production; use `Authorization: Bearer <token>` or `X-Session-Token`.

---

## Secrets Management

Use Google Secret Manager (or equivalent) to inject secrets as environment variables. No code changes are needed; the app reads from `process.env` as usual. Document required vars per feature as above.
