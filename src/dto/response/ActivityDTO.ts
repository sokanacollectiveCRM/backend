/**
 * ActivityDTO - Canonical response shape for activity data.
 * HIPAA COMPLIANCE: Operational fields ONLY - NO PHI.
 * Used in SPLIT_DB_READ_MODE=primary.
 */
export interface ActivityDTO {
  id: string;
  client_id: string;
  created_by?: string;
  activity_type: string;
  content: string;
  created_at: string;
}
