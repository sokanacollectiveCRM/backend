# Why "ECONNREFUSED 127.0.0.1:5433" in production (Vercel)

## What the error means

- **Error:** `connect ECONNREFUSED 127.0.0.1:5433`
- **Cause:** The backend is trying to connect to Cloud SQL at **127.0.0.1:5433** (localhost). That only works **locally** when the **Cloud SQL Auth Proxy** is running on your machine. On **Vercel** (or any production host), nothing is listening on 127.0.0.1:5433, so the connection is refused and you get a 500 (e.g. on `/api/financial/reconciliation`, customers, etc.).

So: **production env vars are still pointing at localhost.**

---

## Fix: Set production Cloud SQL env vars on Vercel

In **Vercel** → your project → **Settings** → **Environment Variables**, set **production** values for Cloud SQL. **Do not** use 127.0.0.1 or 5433 in production.

### 1. Get your Cloud SQL instance details (GCP)

- **Public IP:** In Google Cloud Console → SQL → your instance → **Overview** → copy the **Public IP address** (you must have "Public IP" enabled).
- **Port:** Usually **5432** for Postgres (not 5433; 5433 is only for the proxy locally).
- **Database name:** e.g. `sokana_private`
- **User / password:** Same app user you use locally (or a dedicated prod user).

### 2. Allow Vercel to reach Cloud SQL

- In Cloud SQL → **Connections** → **Networking** → **Authorized networks**, add:
  - Either the **outbound IPs** of Vercel (see [Vercel docs](https://vercel.com/docs/security/secure-your-deployment#ip-allowlist)) if you have static IPs,
  - Or **0.0.0.0/0** for "allow from anywhere" (less secure; use only if you can’t use a fixed IP list and you rely on SSL + strong password).

### 3. Set these env vars in Vercel (Production)

| Variable | Example (replace with your values) |
|----------|------------------------------------|
| **CLOUD_SQL_HOST** | Your instance **public IP** (e.g. `34.123.45.67`). **Not** 127.0.0.1. |
| **CLOUD_SQL_PORT** | **5432** (Postgres default). Not 5433. |
| **CLOUD_SQL_DATABASE** | `sokana_private` |
| **CLOUD_SQL_USER** | Your DB user |
| **CLOUD_SQL_PASSWORD** | Your DB password |
| **CLOUD_SQL_SSLMODE** | **require** (use SSL in prod; do not use `disable`) |

Remove or override any **production** vars that set `CLOUD_SQL_HOST=127.0.0.1` or `CLOUD_SQL_PORT=5433`.

### 4. Redeploy

Redeploy the backend on Vercel so the new env vars are used. After that, calls to `/api/financial/reconciliation` and other Cloud SQL–backed routes should stop hitting 127.0.0.1 and the 500s should stop (assuming the instance is reachable and auth is correct).

---

## Summary

| Environment | CLOUD_SQL_HOST | CLOUD_SQL_PORT | CLOUD_SQL_SSLMODE |
|-------------|----------------|----------------|-------------------|
| **Local** (with proxy) | 127.0.0.1 | 5433 | disable |
| **Production (Vercel)** | Cloud SQL **public IP** | 5432 | require |

Using 127.0.0.1 in production causes **ECONNREFUSED** and 500s; switch production to the real Cloud SQL host and port.
