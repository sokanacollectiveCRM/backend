import { ActivityDTO } from '../dto/response/ActivityDTO';

/**
 * ActivityMapper - Maps raw database rows to canonical ActivityDTO.
 * HIPAA COMPLIANCE: Only operational fields, NO PHI.
 */
export class ActivityMapper {
  /**
   * Maps a client_activities row to ActivityDTO.
   * 
   * @param row - Raw database row from client_activities table
   * @returns ActivityDTO with canonical field names
   */
  static toDTO(row: {
    id: string;
    client_id: string;
    created_by: string | null;
    activity_type: string;
    content: string;
    created_at: string;
  }): ActivityDTO {
    return {
      id: row.id,
      client_id: row.client_id,
      created_by: row.created_by ?? undefined,
      activity_type: row.activity_type,
      content: row.content,
      created_at: row.created_at,
    };
  }
}
