/**
 * DTO for single client detail in canonical API response.
 * Flat structure with snake_case fields - no nested user object.
 * Used by GET /clients/:id when SPLIT_DB_READ_MODE=primary.
 * 
 * HIPAA COMPLIANCE:
 * - Operational fields (non-PHI) are always included
 * - PHI fields are OPTIONAL and only included when user is authorized
 * - When unauthorized, PHI fields are OMITTED (not set to null)
 * 
 * OPERATIONAL (always included):
 * - id, first_name, last_name (identifiers)
 * - email, phone_number (PII - needed for contact, redact in logs)
 * - status, service_needed (workflow state)
 * - portal_status, invite tracking fields
 * - requested_at, updated_at (timestamps)
 * - is_eligible (computed flag)
 * 
 * PHI (only when authorized via PHI Broker - omitted otherwise):
 * - Pregnancy: due_date, pregnancy_number, baby_sex, baby_name, number_of_babies
 * - Past pregnancies: had_previous_pregnancies, previous_pregnancies_count,
 *   living_children_count, past_pregnancy_experience
 * - Health: health_history, health_notes, allergies
 * - Demographics: race_ethnicity, client_age_range, annual_income, insurance
 */
export interface ClientDetailDTO {
  // ========== OPERATIONAL FIELDS (always included) ==========
  id: string;

  first_name: string;
  last_name: string;

  email?: string;
  phone_number?: string;
  address?: string;
  bio?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;

  status: string;
  service_needed?: string;

  portal_status?: string;
  invited_at?: string;
  last_invite_sent_at?: string;
  invite_sent_count?: number;

  requested_at?: string;
  updated_at?: string;

  is_eligible?: boolean;

  // ========== PHI FIELDS (only when authorized; omitted otherwise) ==========
  // These fields come from PHI Broker (Cloud SQL) and are gated by authorization.
  // When user is not authorized, these keys are NOT present in the response.

  // Pregnancy info
  due_date?: string;
  pregnancy_number?: number;
  baby_sex?: string;
  baby_name?: string;
  number_of_babies?: number;

  // Past pregnancies
  had_previous_pregnancies?: boolean;
  previous_pregnancies_count?: number;
  living_children_count?: number;
  past_pregnancy_experience?: string;

  // Health
  health_history?: string;
  health_notes?: string;
  allergies?: string;
  medications?: string;

  // Demographics / contact
  date_of_birth?: string;
  address_line1?: string;

  // Demographics
  race_ethnicity?: string;
  client_age_range?: string;
  annual_income?: string;
  insurance?: string;
}
