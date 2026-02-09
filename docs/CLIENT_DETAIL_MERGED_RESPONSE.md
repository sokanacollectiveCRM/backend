# Client detail: merged response for modal

## Contract

**GET /clients/:id** (when authorized for PHI) returns **one merged object** in `data`:

- **Base (Supabase):** Operational fields from `client_info` (id, status, service_needed, portal_status, requested_at, updated_at, is_eligible, etc.).
- **PHI (Cloud Run broker):** Sensitive fields from PHI Broker (phone_number, due_date, date_of_birth, address_line1, health_history, allergies, medications, etc.).
- **Response shape:** `{ success: true, data: { ...supabaseDTO, ...phiFromBroker } }`.

The backend merges in the handler before responding: `merged = { ...dto, ...phiData }` → `res.json(ApiResponse.success(merged))`. The frontend’s `get<ClientDetailDTO>('/clients/${id}')` only sees `response.data`, so it receives that single merged object.

## Why one object in `data`

- **LeadProfileModal** (and any client-detail UI) uses one source for display and form init: `detailSource = client.data ?? client` (and, if present, `client.phi` or `client.data.phi` is merged on the frontend for legacy/direct-fetch cases).
- For the normal flow that uses the generic `get()` and only gets `response.data`, **all fields must be on `data`**. So the backend merges Supabase + PHI into that one `data` object. Then:
  - Phone Number, Due Date, Date of Birth, Address, Service Needed, etc. all come from `data`.
  - One object populates the modal; no separate “operational vs PHI” handling needed in the UI for this flow.

## If backend ever returned two groups

If the backend instead returned `{ success, data: { ...supabase }, phi: { ...cloudRun } }`, the current `get()` would only pass `data` to the frontend (no `phi`). To support both groups without changing the generic `get()`, the backend would still merge into `data` before sending, e.g. `data: { ...supabase, ...phi }`, so the frontend still receives one merged object in `data`. The current implementation already does this merge in the handler and returns a single `data` object.

## Summary

- Backend: **merge Supabase DTO + PHI Broker result** and return **one payload** in `data`.
- Frontend: uses `response.data` as the single source for the modal when using `get('/clients/${id}')`.
- Result: both operational and PHI fields show up in the modal from one request.
