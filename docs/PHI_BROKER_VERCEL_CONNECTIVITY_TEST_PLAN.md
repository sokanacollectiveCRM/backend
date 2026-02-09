# PHI Broker ↔ Vercel Connectivity & Authorization Test Plan

**Purpose:** Validate Vercel → PHI Broker → Cloud SQL connectivity and authorization in a deterministic order.

**Context:**
- PHI Broker (Cloud Run): `https://sokana-phi-broker-634744984887.us-central1.run.app`
- Broker auth: HMAC shared-secret (`PHI_BROKER_SHARED_SECRET`); Vercel uses `PHI_BROKER_URL` + `PHI_BROKER_SHARED_SECRET`
- Cloud SQL DB: `sokana_private`; PHI table used by broker (see repo): `phi` (column `client_id`). *If your DB uses `public.phi_clients`, confirm schema/table name in broker repo.*

---

## 1. Minimal curl commands (run locally, in order)

**Prereqs**

**Environment choice (Local vs Prod):** Use the same test steps for both—only swap the base URLs + make sure secrets match the environment.

- **Local**
  - `BROKER_URL=http://localhost:8080`
  - `VERCEL_BASE=http://localhost:<your-backend-port>`
  - `SHARED_SECRET=<local-secret>`
  - Use a local auth session/JWT/cookie that your local backend accepts
- **Prod**
  - `BROKER_URL=https://sokana-phi-broker-634744984887.us-central1.run.app`
  - `VERCEL_BASE=https://crmbackend-six-wine.vercel.app`
  - `SHARED_SECRET=<prod-secret>`
  - Use a prod auth session/JWT/cookie that your prod backend accepts

**Tiny but important rule:** Do not mix environments. Prod Vercel must call prod Broker using the prod shared secret (and vice versa). If you cross the streams, you’ll get silent “no PHI” or auth failures.

### Step 1 — Broker health (no auth)

```bash
curl -s -o /dev/null -w "%{http_code}" "$BROKER_URL/health"
# Expected: 200. Body should include "db":"connected".
curl -s "$BROKER_URL/health"
```

### Step 2 — Broker protected endpoint WITHOUT auth (must deny)

```bash
# No timestamp/signature headers → must 401
curl -s -o /dev/null -w "%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"00000000-0000-0000-0000-000000000000","requester":{"role":"admin","user_id":"test"}}'
# Expected: 401
```

### Step 3 — Broker protected endpoint WITH auth (must allow)

Body must match exactly what you sign (no extra spaces). Use a real `client_id` that exists in `phi` (or expect `data: {}` if not found).

```bash
BODY='{"client_id":"<REAL_CLIENT_UUID>","requester":{"role":"admin","user_id":"<REAL_USER_UUID>","assigned_client_ids":[]}}'
TS=$(date +%s000)
# macOS:
SIG=$(echo -n "${TS}.${BODY}" | openssl dgst -sha256 -hmac "$SHARED_SECRET" | awk '{print $2}')
# Linux (e.g. GitHub Actions): often
# SIG=$(echo -n "${TS}.${BODY}" | openssl dgst -sha256 -hmac "$SHARED_SECRET" | awk '{print $2}')

curl -s -w "\n%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -H "X-Sokana-Timestamp: $TS" \
  -H "X-Sokana-Signature: $SIG" \
  -d "$BODY"
# Expected: 200 and JSON with success: true, data: { ... } (PHI keys only when row exists).
```

### Step 4 — Vercel endpoint that triggers PHI hydration (must 200 + PHI when authorized)

Replace `VERCEL_BASE` (local e.g. `http://localhost:3000` or prod API URL), `CLIENT_ID`, and JWT for an admin (or doula assigned to that client).

```bash
curl -s -w "\n%{http_code}" "$VERCEL_BASE/clients/$CLIENT_ID" \
  -H "Authorization: Bearer <JWT>"
# Expected: 200. Body: { "success": true, "data": { ... } } with PHI keys present when authorized.
```

---

## 2. Headers checklist (broker HMAC auth)

Broker expects (in code):

| Header               | Purpose |
|----------------------|--------|
| `X-Sokana-Timestamp` | Unix time in ms; must be within ±5 minutes of server time. |
| `X-Sokana-Signature` | HMAC-SHA256 of `timestamp + "." + rawBody`, hex-encoded. |

**Checklist to confirm in your repo (don’t assume names):**
- [ ] Timestamp header name (e.g. `X-Sokana-Timestamp` or similar).
- [ ] Signature header name (e.g. `X-Sokana-Signature`).
- [ ] Signature input: `timestamp + "." + rawBody` (rawBody = exact request body string).
- [ ] Algorithm: HMAC-SHA256, digest hex.

Use the ripgrep commands below to find the exact header names and payload format.

---

## 3. How to find broker route and auth header names (ripgrep)

Run from repo root (e.g. `backend/`).

**Protected broker route:**
```bash
rg -n "app\.(get|post|put|patch|delete)\s*\(.*phi|/v1/phi" --type-add 'ts:*.ts' -t ts
# Or broader:
rg -n "/v1/phi|phi/client" phi-broker/
```

**Auth middleware / header names:**
```bash
rg -n "verifySignature|Signature|Timestamp|req\.headers\[" phi-broker/
rg -n "x-sokana|X-Sokana" phi-broker/ -i
```

**Backend call to broker (URL + headers):**
```bash
rg -n "PHI_BROKER_URL|phi/client|X-Sokana" src/
```

**Vercel route that returns client with PHI:**
```bash
rg -n "getClientById|fetchClientPhi" src/
rg -n "get.*/:id|clients/:id" src/routes/
```

*(Discovered in this repo: protected route `POST /v1/phi/client`; headers `X-Sokana-Timestamp`, `X-Sokana-Signature`; Vercel route `GET /clients/:id` or `GET /client/:id`.)*

---

## 4. What to inspect in Cloud Run logs (no PHI)

- **Successful auth:** Look for `[Auth]` only in failure cases; no log line means signature passed.
- **Request handling:** `[PHI] Request` with `client_id`, `user_id`, `role`, `authorized`, `latency_ms` (no PHI values).
- **Response:** `[PHI] Response` with `client_id`, `user_id`, `authorized: true`, `field_count`, `latency_ms`.
- **DB:** Health uses `testConnection()`; PHI path uses `getPhiByClientId` → one SELECT per request. Check for DB errors (no row content).
- **Avoid:** Searching for or logging any PHI (names, DOB, email, etc.) in log queries.

---

## 5. “Known good” response shapes (keys only)

**Broker `POST /v1/phi/client` (success):**
```json
{
  "success": true,
  "data": {
    "first_name?", "last_name?", "email?", "phone_number?", "date_of_birth?",
    "address_line1?", "due_date?", "health_history?", "allergies?", "medications?"
  }
}
```
*(Only present keys when row exists and requester is authorized.)*

**Broker error (e.g. 401):**
```json
{
  "success": false,
  "error": "...",
  "code?": "..."
}
```

**Vercel `GET /clients/:id` (success, with PHI when authorized):**
```json
{
  "success": true,
  "data": {
    "id", "first_name", "last_name", "email?", "phone_number?", "status", "service_needed?",
    "portal_status?", "invited_at?", "last_invite_sent_at?", "invite_sent_count?", "requested_at?", "updated_at?", "is_eligible?",
    "due_date?", "pregnancy_number?", "baby_sex?", "baby_name?", "number_of_babies?",
    "had_previous_pregnancies?", "previous_pregnancies_count?", "living_children_count?", "past_pregnancy_experience?",
    "health_history?", "health_notes?", "allergies?", "medications?",
    "date_of_birth?", "address_line1?", "race_ethnicity?", "client_age_range?", "annual_income?", "insurance?"
  }
}
```
*(PHI keys only when user is authorized; otherwise omitted.)*

---

## 6. Rollback if PHI is accidentally exposed

1. **Immediate:** Disable or restrict the exposed route (e.g. feature flag, Vercel env to bypass PHI, or revert deploy).
2. **Access:** Rotate `PHI_BROKER_SHARED_SECRET` (broker + Vercel); redeploy broker and backend so old secret no longer works.
3. **Audit:** Review Cloud Run and Vercel logs for the exposed endpoint; document scope (which clients, time range).
4. **Notify:** Per policy, trigger breach assessment/notification if PHI was actually accessed by unauthorized parties.
5. **Prevent:** Restore correct auth and re-validate with this test plan before re-enabling PHI on the route.

---

## One question

**What is the Vercel base URL for the backend (or a sample endpoint URL)?**  
Example: `https://your-app.vercel.app` or `https://api.your-domain.com`.  
Use that for `VERCEL_BASE` in the Prereqs and for Step 4 (e.g. `$VERCEL_BASE/clients/<id>`).  
If you paste your actual Vercel backend URL (the API base you hit), the prereq block can be rewritten with your real values filled in.

---

## Table name note

Broker repository uses table `phi` and column `client_id`. If your Cloud SQL database uses `public.phi_clients`, confirm the broker’s `phiRepository` (or equivalent) points at the correct schema/table:

```bash
rg -n "FROM phi|phi_clients" phi-broker/
```
