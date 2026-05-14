# Backend handoff: request intake & client referral fields (`referral_source_other`)

## Status: closed

## Completion summary (2026-05-11)

- **Intake** (`POST /requestService/requestSubmission` → `RequestFormService.newForm`): `referral_source` is required and must be one of the CRM enum values; `referral_source_other` is required (trimmed non-empty) when source is `Other`; otherwise stored as null. `referral_email` validated when non-empty. Shared rules in `src/constants/referralSource.ts` (`parseIntakeReferral`).
- **Persistence**: `phi_clients` INSERT extended with `referral_source`, `referral_name`, `referral_email`, `referral_source_other`. Migration `src/db/migrations/add_phi_clients_referral_intake_fields.sql` adds columns if missing.
- **Staff PATCH** (`updateClient`): `normalizeStaffReferralOperationalPatch` runs when any referral field is present; if `referral_source` is set to a non-`Other` value, **`referral_source_other` is cleared server-side** (`null`).
- **GET /clients/:id** (PHI merge): returns `referral_source_other` with other referral fields.
- **Types / entities**: `RequestFormData`, `RequestFormResponse`, `User`, `ClientDetailDTO`, `RequestForm` entity; `cloudSqlClientRepository` map + `updateClient` + `updateClientOperational` allowlists; `phiFields` `OPERATIONAL_UPDATE_COLUMNS` + `referralSourceOther` alias; `supabaseClientRepository` parity for shadow/legacy.
- **Tests**: `src/__tests__/requestEndpoint.test.ts` updated and expanded.
- **Docs**: `docs/CLOUD_SQL_SOKANA_PRIVATE_SCHEMA.md` updated.

---

## Direction (original)

`frontend` → `backend` (Sokana CRM frontend contract)

## Summary (original)

The public **request form** and **admin lead/client profile** were updated in the frontend. Align the API and persistence layer so the same fields validate, save, and return consistently.

---

## 1. `referral_source_other` (new)

### Behavior (match frontend)

- `referral_source` remains a **required** categorical value on intake (one of the known options, including **`Other`**).
- When `referral_source === "Other"`, **`referral_source_other`** is **required**: non-empty string after trim (free-text explanation of how the client heard about Sokana).
- When `referral_source !== "Other"`, **`referral_source_other`** should be **optional**; treat empty/null as “not provided” and **prefer clearing** any stored value if the client changes from `Other` to another option.

### Allowed `referral_source` values (must include `Other`)

`Google`, `Doula Match`, `Former client`, `Sokana Member`, `Social Media`, `Email Blast`, `Other`

### Endpoints to update

1. **Request submission** — `POST /requestService/requestSubmission` (`src/routes/requestRoute.ts`, `RequestFormService`, `RequestFormController`, `RequestFormRepository`).
2. **Client / lead read + update** — staff CRM (`GET`/`PATCH` client flows in `clientController`, `cloudSqlClientRepository`, `ClientDetailDTO`, `User` entity / serializers).

### Database

- Nullable columns on `public.phi_clients`: `referral_source`, `referral_name`, `referral_email`, `referral_source_other` (migration adds if missing).

---

## 4. Acceptance criteria (backend)

- [x] Request submission accepts and stores **`referral_source_other`** when `referral_source` is **`Other`**; rejects missing/blank **`referral_source_other`** in that case with a clear validation error.
- [x] Request submission accepts **`referral_source`** = **`Other`** as a valid enum/value.
- [x] Client/lead detail APIs return **`referral_source_other`** when set.
- [x] Staff updates can set or clear **`referral_source_other`**; changing **`referral_source`** away from **`Other`** clears **`referral_source_other`** server-side.
- [x] Migration + ORM/model/DTO updates completed; no silent drops of the new key in serializers.

---

## Completion checklist

- [x] Implementation merged
- [x] Tests green (`npm test -- --testPathPattern=requestEndpoint`)
- [x] Handoff moved to `closed/` with summary and status updated
