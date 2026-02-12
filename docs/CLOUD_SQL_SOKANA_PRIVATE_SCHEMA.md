# Google Cloud SQL — sokana_private schema outline

Target database: **sokana_private** (PostgreSQL, accessed via Cloud SQL Proxy).

---

## Admin login and profiles (planned)

- **Admin login:** `jerrybony5@gmail.com` should be able to log in as admin. Role is read from Supabase Auth (`user_metadata.role` or `app_metadata.role`). Ensure that user has `role: 'admin'` in Supabase Dashboard → Authentication → Users → (user) → Edit → User Metadata or App Metadata.
- **Profiles table:** A table will be created to hold profiles (see `migrations/create_profiles_table_placeholder.sql`). **Who is in stages of progress and who should have a profile will be decided later**; the placeholder table can be extended once that is defined.

---

## 1. Overview

| Schema | Purpose |
|--------|--------|
| **public** | All application and migration tables |

**PHI tables (migration + app):** `phi_clients`, `phi_notes`, `phi_contracts`, `phi_events`, `phi_invoices`, `phi_time_track`, `phi_access_audit`  
**Non-PHI tables (migration):** `library_items`, `expenses`, `payments`

---

## 2. Primary keys

| Table | Constraint | Column(s) | Type |
|-------|------------|-----------|------|
| phi_clients | phi_clients_pkey | id | uuid |
| phi_notes | phi_notes_pkey | id | uuid |
| phi_contracts | phi_contracts_pkey | id | uuid |
| phi_events | phi_events_pkey | id | uuid |
| phi_invoices | phi_invoices_pkey | id | uuid |
| phi_time_track | phi_time_track_pkey | id | uuid |
| phi_access_audit | phi_access_audit_pkey | id | bigint (serial) |
| library_items | library_items_pkey | id | integer (serial) |
| expenses | expenses_pkey | id | integer (serial) |
| payments | payments_pkey | id | integer (serial) |

---

## 3. Foreign keys and relationships

| Child table | FK column | Parent table | Parent PK | Constraint name | ON DELETE |
|-------------|-----------|--------------|-----------|------------------|-----------|
| phi_notes | client_id | phi_clients | id | phi_notes_client_id_fkey | CASCADE |
| phi_contracts | client_id | phi_clients | id | phi_contracts_client_id_fkey | CASCADE |
| phi_events | client_id | phi_clients | id | phi_events_client_id_fkey | CASCADE |
| phi_invoices | client_id | phi_clients | id | phi_invoices_client_id_fkey | CASCADE |
| phi_time_track | client_id | phi_clients | id | phi_time_track_client_id_fkey | CASCADE |
| payments | client_id | phi_clients | id | payments_client_id_fkey | (default) |

**Relationship summary:** `phi_clients` is the only parent; all PHI child tables reference it with ON DELETE CASCADE (except `payments`, nullable, no CASCADE). `phi_access_audit` has no FK; it links via `resource_type` + `resource_id`. `library_items` and `expenses` have no foreign keys.

---

## 4. Full table definitions (summary)

### public.phi_clients

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | — |
| first_name | text | NO | — |
| last_name | text | NO | — |
| email | text | YES | — |
| phone | text | YES | — |
| date_of_birth | date | YES | — |
| address_line1 | text | YES | — |
| due_date | date | YES | — |
| health_history | text | YES | — |
| allergies | text | YES | — |
| medications | text | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| client_id | uuid | YES | — |
| health_notes | text | YES | — |
| pregnancy_number | integer | YES | — |
| had_previous_pregnancies | boolean | YES | — |
| previous_pregnancies_count | integer | YES | — |
| living_children_count | integer | YES | — |
| past_pregnancy_experience | text | YES | — |
| baby_sex | text | YES | — |
| baby_name | text | YES | — |
| number_of_babies | integer | YES | — |
| race_ethnicity | text | YES | — |
| client_age_range | text | YES | — |
| annual_income | text | YES | — |
| insurance | text | YES | — |

**Indexes:** phi_clients_pkey (id), idx_phi_clients_email (email). Migration: upsert on `id` (ON CONFLICT DO UPDATE).

### public.phi_notes

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| client_id | uuid | NO | — |
| note_date | timestamptz | NO | — |
| title | text | YES | — |
| note_content | text | YES | '' |
| created_at | timestamptz | YES | now() |

**Unique index (dedupe):** `uq_phi_notes_migration_dedupe` UNIQUE (`client_id`, `note_date`, `md5(coalesce(title,'') || '|' || coalesce(note_content,'')))`. Migration uses ON CONFLICT on this for idempotent inserts.

### public.phi_contracts, phi_events, phi_invoices, phi_time_track, phi_access_audit

See full outline in repo; all reference `phi_clients(id)` except phi_access_audit (logical link via resource_id/type).

### public.library_items, expenses, payments

Non-PHI; payments has optional `client_id` → phi_clients(id).

---

## 5. Backend alignment (Express app)

- **Database name:** Set `CLOUD_SQL_DATABASE=sokana_private` in `.env`.
- **Client table:** Backend uses **`phi_clients`** (not `clients`). Column **`phone`** is mapped to app `phone_number`.
- **Backend-required columns on phi_clients:** For list/detail and role scoping, the backend expects these columns on `phi_clients`. If missing, add them with `migrations/alter_phi_clients_backend_columns.sql`:
  - `status`, `service_needed`, `portal_status`, `user_id`, `requested_at`
  - `invited_at`, `last_invite_sent_at`, `invite_sent_count` (for portal flows)
- **Doula scoping:** Use `public.assignments` (FK to `phi_clients(id)`). Create it with `migrations/create_phi_assignments_if_not_exists.sql` so the backend can filter clients by doula.
- **Creating clients:** A client profile will usually need to be created in **Google Cloud SQL** when creating new clients from the app (e.g. insert into `phi_clients`). Ensure the backend or a sync job inserts into `phi_clients` when a new client is added so list/detail stay in sync. If using a separate Cloud SQL instance, ensure a **database/user (client) profile** exists there for the app to connect (e.g. Cloud SQL Proxy and DB user for `sokana_private`).

---

## 6. Truncate order

```sql
TRUNCATE TABLE
  public.phi_notes,
  public.phi_contracts,
  public.phi_events,
  public.phi_time_track,
  public.phi_invoices,
  public.phi_access_audit,
  public.phi_clients
RESTART IDENTITY CASCADE;
```

Non-PHI tables (`library_items`, `expenses`, `payments`) truncated separately if needed.

---

## 7. Migration script mapping

| CSV / source | Table | Idempotency |
|--------------|--------|-------------|
| Clients.csv | phi_clients | ON CONFLICT (id) DO UPDATE |
| ClientNote.csv | phi_notes | ON CONFLICT (client_id, note_date, md5(...)) DO NOTHING |
| Contracts.csv | phi_contracts | Insert only |
| Events.csv | phi_events | Insert only |
| Invoices.csv | phi_invoices | ON CONFLICT (id) DO NOTHING |
| TimeTrack.csv | phi_time_track | Insert only |
| — (per client) | phi_access_audit | ON CONFLICT (partial index) DO NOTHING |
| LibraryItems.csv | library_items | Insert only |
| Expenses.csv | expenses | Insert only |
| Payments.csv | payments | Insert only |

For exact DDL, run `pg_dump -s` against the database.
