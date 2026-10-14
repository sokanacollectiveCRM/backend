# Pilot scheduling MVP

Backend half of the Sokana360 doula/client visit scheduling pilot.
Frontend implements against this contract. Do not invent different paths.

**Visits are a fixed 60 minutes.** Stored in UTC (`timestamptz`). Emails show
`America/Chicago` with a zone label. The CRM UI should show the browser zone
plus a label.

Existing routes stay unchanged:

- `GET/POST /api/doulas/availability`, `PATCH/DELETE /api/doulas/availability/:availabilityId`
- `GET /clients/:id/assigned-doulas`
- `POST /clients/:id/assigned-doulas/:doulaId/booking-requests`

## Environment

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `BOOKING_REQUIRE_CONTRACT_STAGE` | `true` | Booking and open-slot listing require a `phi_contracts` row for the client. **Set to `false` on dev for the Oct 12 pilot** if pilot clients have no contract. Leave `true` in code/prod. |
| `FRONTEND_URL` | `http://localhost:3001` | Login links in booking emails |
| `USE_TEST_EMAIL` | unset | When `true`, `emailService.sendEmail` does not SMTP. Automated tests must set this or mock the transport. **Dev sends real mail** to Jerry plus-addresses. |

## Endpoints

All routes are mounted at `/api/scheduling`. Session cookie / `X-Session-Token`
+ `authMiddleware`. Doulas and clients must be inbox-verified (existing main
policy). Success bodies use `{ success: true, ... }`. Errors use
`{ error, code? }`.

### `GET /api/scheduling/client/doulas/:doulaId/slots`

Roles: `client` (own client + **active** assignment).

Query:

- `from` (ISO, required)
- `to` (ISO, required)
- `durationMinutes` (optional, must be `60` if sent)

Open slots = `available` windows − `unavailable` blackouts −
`pending`/`approved` bookings, aligned to each window start, **future only**,
max **14-day** range.

`200`

```json
{
  "success": true,
  "durationMinutes": 60,
  "from": "2026-10-13T00:00:00.000Z",
  "to": "2026-10-27T00:00:00.000Z",
  "slots": [{ "startAt": "2026-10-13T15:00:00.000Z", "endAt": "2026-10-13T16:00:00.000Z" }]
}
```

`400` range/duration · `403` `CONTRACT_STAGE_REQUIRED` · `404` no profile /
inactive assignment.

### `POST /api/scheduling/client/bookings`

Roles: `client`, `admin`.

```json
{
  "doulaId": "uuid",
  "startAt": "2026-10-20T15:00:00.000Z",
  "endAt": "2026-10-20T16:00:00.000Z",
  "notes": "optional — never emailed or logged",
  "clientId": "uuid — required for admin"
}
```

Checks (same intent as `createDoulaBookingRequest`): own client (clients
cannot book for someone else), active assignment, contract-stage gate.
Must lie fully inside an `available` window. `409` on blackout or overlap
with another pending/approved booking for that doula. Overlap + insert run
in one transaction with `pg_advisory_xact_lock(hashtext(doula_id::text))`.

`201 { "success": true, "booking": { ... } }`

`409` codes: `BOOKING_OUTSIDE_WINDOW` · `BOOKING_BLACKOUT` · `BOOKING_OVERLAP`.

### `GET /api/scheduling/client/bookings`

Roles: `client` (own). `200 { "success": true, "bookings": [ ... ] }`

### `GET /api/scheduling/doula/bookings?from&to`

Roles: `doula` (own). Optional `from`/`to` overlap filter.
`200 { "success": true, "bookings": [ ... ] }`

### `GET /api/scheduling/admin/bookings?doulaId&clientId&status&from&to`

Roles: `admin`. Each booking includes `doulaName`, `clientNumber`,
`clientFirstName` only (no last name, no health fields).

### `PATCH /api/scheduling/bookings/:id`

```json
{ "status": "approved" | "rejected" | "cancelled" | "pending" }
```

- Doula (own): `approved` / `rejected` / `cancelled`
- Client (own): `cancelled` on pending or approved
- Admin: any. Approving re-checks overlap.

`200 { "success": true, "booking": { ... } }`

### `GET /api/scheduling/admin/doulas/:doulaId/availability`

Roles: `admin`, read-only.
`200 { "success": true, "records": [ ... ] }` (same shape as doula availability CRUD).

### Booking object

```json
{
  "id": "uuid",
  "clientId": "uuid",
  "doulaId": "uuid",
  "startAt": "ISO UTC",
  "endAt": "ISO UTC",
  "status": "pending|approved|rejected|cancelled",
  "notes": "string|null",
  "requestedBy": "uuid|null",
  "createdAt": "ISO UTC",
  "updatedAt": "ISO UTC"
}
```

## Emails

Best-effort; failures are logged without PHI and never fail the request.

| Event | Recipients |
| ----- | ---------- |
| New request | Doula |
| Approved / declined / cancelled | Client |
| Client cancels | Client **and** doula |

Content: visit date/time with Chicago zone label + “log in to view” link.
No notes, names (except client **number** on doula mail), or health details.

## Fixture accounts (dev only)

| Role | Name | Email |
| ---- | ---- | ----- |
| Doula | Maya Rivers | `jerry+sokanadoula@techluminateacademy.com` |
| Client | Jordan Lake | `jerry+sokanaclient@techluminateacademy.com` |
| Admin | Pilot Admin | `jerry+sokanaadmin@techluminateacademy.com` |

```bash
npx tsx scripts/dev-env/seed-scheduling-fixture.ts
npx tsx scripts/dev-env/seed-scheduling-fixture.ts --cleanup
```

The script refuses unless `NODE_ENV !== production` and the Cloud SQL host /
database / instance name contains `dev`. Set `SCHEDULING_FIXTURE_PASSWORD`
plus Firebase Admin credentials to create verified Identity Platform users.

## Jerry — exact dev rollout order

1. **Migrate dev only** (never prod):

   ```bash
   npm run migrate:cloudsql -- src/db/migrations/add_doula_availability_and_scheduling_cloudsql.sql
   npm run migrate:cloudsql -- src/db/migrations/20261009_phi_clients_primary_language_other.sql
   npm run migrate:cloudsql -- src/db/migrations/20261011_scheduling_booking_overlap_index.sql
   ```

   Skip the `#98` language migration if it is already applied.

2. **Deploy** branch `pilot/backend-dev-20261012` to **`sokana-private-api-dev`**.
   Do not deploy this to production. Do not include PR #96 or #97.

3. **Deploy** frontend integration branch `pilot/frontend-dev-20261012` to
   **`sokana-front-end-dev`**.

4. **Set on the dev Cloud Run service** (keep the code default `true`; override
   only if pilot clients have no contract):

   ```text
   BOOKING_REQUIRE_CONTRACT_STAGE=false
   ```

   Leave `USE_TEST_EMAIL` unset on dev so plus-address mail is real. Automated
   tests use `USE_TEST_EMAIL=true` or a mocked transport.

5. **Seed** (from a shell pointed at the **dev** Cloud SQL proxy / env):

   ```bash
   export SCHEDULING_FIXTURE_PASSWORD='<pilot password>'
   npx tsx scripts/dev-env/seed-scheduling-fixture.ts
   ```

6. **Run** the frontend live Playwright config
   (`playwright.scheduling-dev.config.ts`) against dev.

7. **Cleanup** after the recording / pilot:

   ```bash
   npx tsx scripts/dev-env/seed-scheduling-fixture.ts --cleanup
   ```

## Known limitations

- No recurring-availability rules table (frontend expands weekly repeats into rows).
- No appointment reminders (needs PR #97 event types; not in this deploy).
- No Google/Outlook sync, ICS, SMS, or visit-type durations.
- Double-booking is enforced in a transaction + advisory lock, not a
  `btree_gist` exclusion constraint.
- The existing `POST .../booking-requests` route is unchanged and still does
  **not** require an available window or check double-booking. Use
  `POST /api/scheduling/client/bookings` for the pilot UI.
