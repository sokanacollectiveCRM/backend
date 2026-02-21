/**
 * DTO for client list items in canonical API response.
 * Flat structure with snake_case fields - no nested user object.
 * Used by GET /clients when SPLIT_DB_READ_MODE=primary.
 * 
 * HIPAA COMPLIANCE:
 * This DTO contains ONLY operational fields (non-PHI).
 * 
 * ALLOWED (operational):
 * - id, first_name, last_name (identifiers)
 * - email, phone_number (PII - needed for contact, redact in logs)
 * - status, portal_status (workflow state)
 * - invited_at, updated_at (timestamps)
 * - is_eligible (computed flag)
 * 
 * NEVER ADD (PHI - belongs in Sensitive DB only):
 * - health_history, allergies, health_notes
 * - due_date, baby_sex, pregnancy info
 * - insurance, SSN, demographics
 * - Any medical or treatment information
 */
export interface ClientListItemDTO {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  bio?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  status: string;
  service_needed?: string;
  portal_status?: string;
  invited_at?: string;
  updated_at?: string;
  is_eligible?: boolean;
}
