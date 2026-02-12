# Google Cloud SQL – full schema (from repo)

This is the schema defined in the backend repo for Cloud SQL. Apply in order: **step3** first, then **phi_notes** if you use PHI notes.

---

## 1. Core tables (`migrations/step3_create_cloudsql_schema.sql`)

### Table: `clients`

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | UUID | gen_random_uuid() | PK |
| user_id | UUID | — | Supabase auth.users.id |
| first_name | VARCHAR(100) | — | PHI |
| last_name | VARCHAR(100) | — | PHI |
| email | VARCHAR(255) | — | UNIQUE, PHI |
| phone_number | VARCHAR(20) | — | PHI |
| date_of_birth | DATE | — | PHI |
| due_date | DATE | — | PHI |
| address_line1 | VARCHAR(255) | — | PHI |
| address_line2 | VARCHAR(255) | — | PHI |
| city | VARCHAR(100) | — | |
| state | VARCHAR(50) | — | |
| zip_code | VARCHAR(10) | — | |
| country | VARCHAR(50) | 'USA' | |
| health_history | TEXT | — | PHI |
| health_notes | TEXT | — | PHI |
| allergies | TEXT | — | PHI |
| medications | TEXT | — | PHI |
| status | VARCHAR(50) | 'pending' | |
| service_needed | VARCHAR(100) | — | |
| portal_status | VARCHAR(50) | 'not_invited' | |
| invited_at | TIMESTAMP | — | |
| last_invite_sent_at | TIMESTAMP | — | |
| invite_sent_count | INTEGER | 0 | |
| profile_picture | TEXT | — | |
| pronouns | VARCHAR(50) | — | |
| preferred_name | VARCHAR(100) | — | |
| payment_method | VARCHAR(50) | — | |
| home_type | VARCHAR(100) | — | |
| service_specifics | TEXT | — | |
| service_support_details | TEXT | — | |
| services_interested | JSONB | '[]' | |
| baby_name | VARCHAR(100) | — | |
| baby_sex | VARCHAR(20) | — | |
| number_of_babies | INTEGER | — | |
| birth_hospital | VARCHAR(255) | — | |
| provider_type | VARCHAR(100) | — | |
| pregnancy_number | INTEGER | — | |
| had_previous_pregnancies | BOOLEAN | — | |
| previous_pregnancies_count | INTEGER | — | |
| living_children_count | INTEGER | — | |
| past_pregnancy_experience | TEXT | — | |
| race_ethnicity | VARCHAR(100) | — | |
| primary_language | VARCHAR(50) | 'English' | |
| client_age_range | VARCHAR(50) | — | |
| insurance | VARCHAR(100) | — | |
| annual_income | VARCHAR(50) | — | |
| preferred_contact_method | VARCHAR(50) | — | |
| relationship_status | VARCHAR(50) | — | |
| referral_source | VARCHAR(100) | — | |
| referral_name | VARCHAR(100) | — | |
| referral_email | VARCHAR(255) | — | |
| requested_at | TIMESTAMP | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | CURRENT_TIMESTAMP | |
| created_at | TIMESTAMP | CURRENT_TIMESTAMP | |

**Indexes:** idx_clients_user_id, idx_clients_email, idx_clients_status, idx_clients_updated_at, idx_clients_portal_status  
**Trigger:** update_clients_updated_at (sets updated_at on UPDATE)

---

### Table: `assignments`

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | UUID | gen_random_uuid() | PK |
| client_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| doula_id | UUID | — | Supabase auth user |
| assigned_by | UUID | — | Supabase auth user (admin) |
| status | VARCHAR(50) | 'active' | |
| assigned_at | TIMESTAMP | CURRENT_TIMESTAMP | |
| unassigned_at | TIMESTAMP | — | |
| created_at | TIMESTAMP | CURRENT_TIMESTAMP | |

**Indexes:** idx_assignments_client_id, idx_assignments_doula_id, idx_assignments_status

---

### Table: `activities`

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | UUID | gen_random_uuid() | PK |
| client_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| created_by | UUID | — | Supabase auth user |
| activity_type | VARCHAR(50) | — | |
| content | TEXT | — | |
| created_at | TIMESTAMP | CURRENT_TIMESTAMP | |

**Indexes:** idx_activities_client_id, idx_activities_created_at

---

## 2. Optional: `phi_notes` (`migrations/phi_notes_dedupe_index.sql`)

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| id | UUID | gen_random_uuid() | PK |
| client_id | UUID | — | NOT NULL |
| note_date | DATE | — | NOT NULL |
| title | TEXT | — | |
| note_content | TEXT | — | |
| created_at | TIMESTAMPTZ | now() | NOT NULL |

**Unique index:** uq_phi_notes_migration_dedupe on (client_id, note_date, md5(coalesce(title,'') \|\| '|' \|\| coalesce(note_content,'')))  
**Function:** insert_phi_note(client_id, note_date, title, note_content) → (out_id, out_inserted) for idempotent insert

---

## Applying the schema

1. **Core (required for backend with Cloud SQL):**  
   Run `migrations/step3_create_cloudsql_schema.sql` in your Cloud SQL instance (psql or Cloud Console).

2. **PHI notes (optional):**  
   Run `migrations/phi_notes_dedupe_index.sql` if you use phi_notes.

The backend uses **only** the `clients` and `assignments` tables (and optionally `activities` / `phi_notes`) from Cloud SQL; auth stays in Supabase.
