# Handoff: Pilot scheduling MVP (frontend contract)

## Metadata

- Direction: `backend->frontend`
- Priority: `P0`
- Requested By: backend scheduling MVP
- Date: `2026-10-11`
- Status: `open`

## API contract

Implement against `docs/SCHEDULING_MVP.md` in the backend repo. Paths, query
params, bodies, and status codes are locked:

- `GET /api/scheduling/client/doulas/:doulaId/slots?from&to&durationMinutes=60`
- `POST /api/scheduling/client/bookings` `{ doulaId, startAt, endAt, notes? }`
  (admin may pass `clientId`)
- `GET /api/scheduling/client/bookings`
- `GET /api/scheduling/doula/bookings?from&to`
- `PATCH /api/scheduling/bookings/:id` `{ status }`
- `GET /api/scheduling/admin/bookings?doulaId&clientId&status&from&to`
- `GET /api/scheduling/admin/doulas/:doulaId/availability`

Success wrappers: `{ success, slots|booking|bookings|records }`.
Times: ISO UTC. Visits: 60 minutes. `403` `CONTRACT_STAGE_REQUIRED` when the
gate is on. `409` `BOOKING_OUTSIDE_WINDOW` / `BOOKING_BLACKOUT` / `BOOKING_OVERLAP`.

Keep using existing `/api/doulas/availability*` for doula window/blackout CRUD.
Fix ProfileTab so saving "Available" does not delete future blackouts.
