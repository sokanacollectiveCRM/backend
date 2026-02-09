# PHI Boundary End-to-End QA Validation

**Role:** Backend QA — validate the PHI boundary and that only authorized paths see PHI.

**Goal:** Validate that:
- Browser/clients **only** call the Vercel backend; **only** the Vercel backend calls the Cloud Run broker.
- Broker connects to Cloud SQL successfully.
- PHI appears **only** for authorized roles.
- **No PHI is logged** (metadata only in logs).

---

## Environment (prod)

| Variable      | Value |
|---------------|--------|
| `VERCEL_BASE` | `https://crmbackend-six-wine.vercel.app` |
| `BROKER_BASE` | `https://sokana-phi-broker-634744984887.us-central1.run.app` |

---

## Inputs (you provide)

| Input         | Description |
|---------------|-------------|
| `CLIENT_ID`   | A client ID that exists in operational `client_info` **and** has a row in Cloud SQL `public.phi_clients` (or broker’s `phi` table if different). |
| `JWT_ADMIN`   | Prod JWT for an admin user (or cookie-based auth if that’s what the backend expects). |

---

## Steps

### 1) Broker health (must be healthy + connected)

**Run:**
```bash
curl -s "$BROKER_BASE/health"
```

**Expected:**
```json
{"status":"healthy","db":"connected"}
```

**Pass:** Response is 200 and body matches above (or equivalent with `status` + `db`).

---

### 2) Backend client detail call (admin should get wrapper with PHI fields)

**Run:**
```bash
curl -s -H "Authorization: Bearer $JWT_ADMIN" "$VERCEL_BASE/clients/$CLIENT_ID" | jq
```

**Expected:**
- Top-level: `{ "success": true, "data": { ... } }`
- `data` contains **operational** keys: `id`, `first_name`, `last_name`, `status`
- `data` contains **PHI** keys when present in DB: e.g. `phone_number`, `due_date`, `date_of_birth`, `address_line1`, `health_history`, `allergies`, `medications`, etc.
- `due_date` and `date_of_birth` are **strings** (YYYY-MM-DD), because the broker casts `date::text`.

**Pass:** 200, `success: true`, and PHI keys present for this admin when the client has a row in the PHI table.

---

### 3) Negative test: broker rejects unsigned calls (broker not public-open)

**Run (must fail with 401/403 or unauthorized):**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BROKER_BASE/v1/phi/client" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'$CLIENT_ID'","requester":{"role":"admin","user_id":"x"}}'
```

**Expected:** HTTP **401** or **403** (or an unauthorized error JSON). The response must **not** return PHI.

**Pass:** Status is 401/403 and response body does not contain PHI fields/values.

---

### 4) Confirm Vercel env vars (manual check)

In **Vercel** → Project → **Settings** → **Environment Variables** (prod):

| Variable                 | Expected value |
|--------------------------|----------------|
| `PHI_BROKER_URL`         | `https://sokana-phi-broker-634744984887.us-central1.run.app` |
| `PHI_BROKER_SHARED_SECRET` | Same value as Cloud Run service env var `PHI_BROKER_SHARED_SECRET` (do not paste in docs). |

**Pass:** Both are set for Production and match the broker’s config.

---

### 5) Logs check (must not log PHI)

**Cloud Run (broker) logs:**
- Requests show **metadata only**: e.g. `client_id`, `user_id`, `role`, `authorized`, `latency_ms`, `field_count`.
- **Must not** contain: PHI field names as logged keys with values, or any `first_name`, `last_name`, `email`, `phone_number`, `date_of_birth`, `due_date`, `health_history`, `allergies`, `medications`, etc. in log message or structured payload.

**Vercel (backend) logs:**
- Backend call to broker is visible (e.g. broker request attempt / success metadata).
- **Must not** log PHI: no PHI field values or full client payloads printed.

**Pass:** No PHI values in Cloud Run or Vercel logs; only metadata (IDs, role, authorized, counts, latency).

---

## Pass criteria (summary)

| # | Check | Pass condition |
|---|--------|-----------------|
| 1 | Broker health | `/health` returns 200 and `{"status":"healthy","db":"connected"}` (or equivalent). |
| 2 | Backend returns PHI for admin | `GET /clients/:id` with admin JWT returns 200, `success: true`, and `data` includes PHI keys when row exists; dates are strings (YYYY-MM-DD). |
| 3 | Broker auth | Direct `POST /v1/phi/client` **without** signature returns 401 or 403 and does **not** return PHI. |
| 4 | Vercel env | `PHI_BROKER_URL` and `PHI_BROKER_SHARED_SECRET` set in Vercel prod and match broker. |
| 5 | No PHI in logs | Cloud Run and Vercel logs show only metadata; no PHI field values. |

**Overall:** All five pass → PHI boundary validated for prod.
