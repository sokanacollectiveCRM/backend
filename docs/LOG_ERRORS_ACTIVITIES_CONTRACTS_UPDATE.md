# Log errors: activities 500, contracts 404, client update 500

From your backend logs you have three separate issues:

---

## 1. GET /clients/:id/activities → 500

**Error:** `Failed to fetch activities: Could not find the table 'public.client_activities' in the schema cache`

**Cause:** Supabase (PostgREST) does not have a table `public.client_activities` in this project, or the schema cache doesn’t see it.

**Backend change (done):** The activities handler now catches this error and returns **200 with an empty list** instead of 500, so the modal doesn’t break.

**To actually have activities:** Create the table in Supabase, e.g.:

```sql
-- Example: create client_activities if it doesn't exist
CREATE TABLE IF NOT EXISTS public.client_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_info(id),
  created_by uuid,
  type text NOT NULL,
  description text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON public.client_activities(client_id);
```

Then run migrations / reload schema in Supabase as needed.

---

## 2. GET /contracts/templates → 404

**Cause:** The backend does **not** expose `/contracts/templates`. It exposes:

- **GET /api/pdf-contract/templates** (pdf contract templates)

So the frontend is calling a path that doesn’t exist.

**Fix (pick one):**

- **A)** Change the frontend to call **GET /api/pdf-contract/templates** (and optionally add `/contracts` to `allowedOrigins` / CORS if needed), or  
- **B)** Add a route in the backend that mounts at `/contracts` and serves templates (e.g. `GET /contracts/templates` → same handler as `/api/pdf-contract/templates` or a redirect).

There is no `/contracts` mount in `server.ts` today; only `/api/contract`, `/api/pdf-contract`, `/api/contract-signing`, `/api/contract-payment`.

---

## 3. PUT /clients/:id → 500 (update profile)

**Error:** `Could not update client profile: Failed to update client: Could not find the 'pronouns' column of 'client_info' in the schema cache`

**Cause:** The backend allows updating `pronouns` (it’s in `ALLOWED_CLIENT_INFO_UPDATE_COLUMNS`), but the Supabase `client_info` table in this project does **not** have a `pronouns` column (or the schema cache doesn’t see it).

**Fix (pick one):**

- **A) Add the column (recommended):** Run a migration on Supabase to add `pronouns` (and any other missing allowed columns) to `client_info`, e.g.:

  ```sql
  ALTER TABLE public.client_info
  ADD COLUMN IF NOT EXISTS pronouns text;
  ```

- **B) Temporarily stop sending pronouns:** In the frontend, don’t send `pronouns` in the update payload until the column exists (then you avoid the 500 but lose that field in the modal until you add the column).

The backend does not currently “skip missing columns”; it sends the whitelisted fields and Supabase returns an error when a column is missing.

---

## Summary

| Issue              | Error / symptom                     | Fix |
|--------------------|-------------------------------------|-----|
| Activities 500     | Table `client_activities` not found | Backend now returns 200 + `[]`. To have data, create the table in Supabase. |
| Contracts 404      | GET /contracts/templates            | Use GET /api/pdf-contract/templates, or add a `/contracts` route that serves templates. |
| Client update 500  | Column `pronouns` not found on `client_info` | Add `pronouns` (and other needed columns) to `client_info` in Supabase, or stop sending them from the frontend until then. |
