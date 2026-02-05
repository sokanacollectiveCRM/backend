/**
 * DTO for single client detail in canonical API response.
 * Flat structure with snake_case fields - no nested user object.
 * Used by GET /clients/:id when SPLIT_DB_READ_MODE=primary.
 * 
 * HIPAA COMPLIANCE:
 * This DTO contains ONLY operational fields (non-PHI).
 * 
 * ALLOWED (operational):
 * - id, first_name, last_name (identifiers)
 * - email, phone_number (PII - needed for contact, redact in logs)
 * - status, service_needed (workflow state)
 * - portal_status, invite tracking fields
 * - requested_at, updated_at (timestamps)
 * - is_eligible (computed flag)
 * 
 * NEVER ADD (PHI - belongs in Sensitive DB only):
 * - health_history, allergies, health_notes
 * - due_date, baby_sex, pregnancy info
 * - insurance, SSN, demographics
 * - Any medical or treatment information
 */
export interface ClientDetailDTO {
  id: string;

  first_name: string;
  last_name: string;

  email?: string;
  phone_number?: string;

  status: string;
  service_needed?: string;

  portal_status?: string;
  invited_at?: string;
  last_invite_sent_at?: string;
  invite_sent_count?: number;

  requested_at?: string;
  updated_at?: string;

  is_eligible?: boolean;

  // IMPORTANT: NO PHI fields in this DTO (no due_date, health_history, insurance, etc.)
}
