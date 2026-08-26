# Vercel Retirement — Verification & Closure Sign-Off

**Ticket:** Infra — Retire Vercel deployments and remove Vercel CORS origins  
**Related:** `docs/HIPAA_BOARD_TECHNICAL_STATUS.md`,
`docs/SECURITY_P0_HARDENING_SUMMARY.md`

---

## Scope verified

Production traffic runs on **Google Cloud Run** (`sokana-private-api`,
`sokana-front-end`). Vercel is no longer a supported deploy target or CORS
origin for the CRM stack.

| Requirement                                          | Result                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Vercel origins removed from backend CORS code        | Pass — `getAllowedOrigins()` no longer includes `*.vercel.app` fallbacks |
| Vercel origins removed from production Cloud Run env | Pass — `FRONTEND_ORIGIN` updated (see Production environment)            |
| `vercel.json` retired (backend)                      | Pass — file deleted from backend repo                                    |
| `vercel.json` retired (frontend)                     | Pass — file deleted from `frontend-crm` repo                             |
| No production API URL env points at Vercel           | Pass — frontend uses Cloud Run backend URL at build time                 |
| Callback paths use Cloud Run                         | Pass — QuickBooks redirect URI on `sokana-private-api` Cloud Run host    |

---

## Production environment

| Item                               | Value                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| Backend service                    | `sokana-private-api`                                        |
| Frontend service                   | `sokana-front-end`                                          |
| Region                             | `us-central1`                                               |
| Project                            | `sokana-private-data`                                       |
| Approved frontend origin (primary) | `https://sokana-front-end-634744984887.us-central1.run.app` |
| Approved frontend origin (alias)   | `https://sokana-front-end-46lcr3n2qa-uc.a.run.app`          |
| Backend API host                   | Cloud Run `sokana-private-api` (`*.run.app`)                |
| Serving revision                   | `sokana-private-api-00057-zqm` @ 100% traffic               |
| `FRONTEND_URL` (backend)           | Cloud Run frontend URL (confirmed on service env)           |

**Production `FRONTEND_ORIGIN` (post-retirement):**

```
http://localhost:3001,http://127.0.0.1:3001,https://sokana-front-end-46lcr3n2qa-uc.a.run.app,https://sokana-front-end-634744984887.us-central1.run.app
```

(Vercel URL `https://sokanacrm.vercel.app` removed.)

---

## Repository / config changes

| Repo             | Change                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **backend**      | Delete `vercel.json`; remove Vercel prod CORS fallbacks in `src/config/env.ts`; update `.env.example`; add `src/__tests__/env.test.ts` |
| **frontend-crm** | Delete `vercel.json`; update production backend URL error text in `src/api/http.ts`                                                    |

---

## Validation results (2026-08-25)

| Test                                             | Expected                                                    | Observed                                                 | Result |
| ------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- | ------ |
| `npm test -- --testPathPattern=env.test`         | No Vercel in allowed origins; prod without env → empty list | 3/3 pass                                                 | Pass   |
| Code search: `vercel.json` in backend + frontend | Absent                                                      | Deleted both repos                                       | Pass   |
| Code search: `sokanacrm.vercel.app` in `src/`    | Absent from runtime code                                    | Only historical docs remain                              | Pass   |
| Cloud Run `FRONTEND_ORIGIN`                      | No `vercel.app` entries                                     | Revision `00057-zqm` serving 100% traffic; `/health` 200 | Pass   |
| QuickBooks `QB_REDIRECT_URI`                     | Cloud Run backend host                                      | Confirmed on `sokana-private-api` env                    | Pass   |

---

## Vercel dashboard retirement (manual infra)

Completed 2026-08-25:

1. **Backend Vercel project** — retired / deleted.
2. **Frontend Vercel project** — retired / deleted.
3. **Supabase Auth redirect URLs** — confirm Site URL and redirect allow-list
   use Cloud Run frontend only (no `*.vercel.app`) when reviewing Auth config.
4. **DNS** — no production traffic depends on Vercel.

---

## Residual risk (acknowledged)

- Historical docs (`docs/PRODUCTION_CLOUD_SQL_VERCEL.md`,
  `docs/VERCEL_ENVIRONMENT_VARIABLES.md`, etc.) still mention Vercel for audit
  trail; they are not runtime config.
- `contractProcessor.ts` still checks `process.env.VERCEL` for serverless
  temp-path behavior; harmless on Cloud Run (env unset).

---

## Sign-off

I confirm that Vercel retirement for the CRM stack has been **implemented in
code, validated by tests, production CORS no longer includes Vercel origins, and
Vercel projects have been retired**, as described above.

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| **Reviewer** | Jerry Bony                                     |
| **Role**     | Engineering verification / compliance reviewer |
| **Date**     | 2026-08-25                                     |
| **Decision** | **Closed / formally approved**                 |

**Formal closure approval:** Approved 2026-08-25 — Vercel dashboard projects
retired; production on Cloud Run only.
