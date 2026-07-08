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
  client_number?: string;
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
  portal_blockers?: string[];
  primary_portal_blocker?: string | null;
  billing_path?: string;
  payment_authorization_required?: boolean;
  payment_authorization_satisfied?: boolean;
  card_on_file?: boolean;
  qb_customer_id?: string | null;
  qb_stored_payment_method_id?: string | null;
  verification_invoice_id?: string | null;
  verification_invoice_sent_at?: string | null;
  verification_invoice_paid_at?: string | null;
  allowed_actions?: {
    can_invite_to_portal: boolean;
    can_send_verification_invoice: boolean;
    can_mark_contract_signed: boolean;
    can_mark_deposit_paid: boolean;
  };
}
