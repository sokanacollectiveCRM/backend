/**
 * ActivityDTO - Canonical response shape for activity data.
 * HIPAA COMPLIANCE: Operational fields ONLY - NO PHI.
 * Used in SPLIT_DB_READ_MODE=primary.
 */
export interface ActivityDTO {
  id: string;
  client_id: string;
  created_by?: string;
  created_by_name?: string;
  created_by_role?: string;
  activity_type: string;
  content: string;
  created_at: string;
  /** When true, the client may see this entry in their portal. Omitted/false = staff-only. */
  visible_to_client?: boolean;
  /** Raw metadata from Cloud SQL (e.g. duration, topic, visibleToClient). */
  metadata?: Record<string, unknown>;
}
