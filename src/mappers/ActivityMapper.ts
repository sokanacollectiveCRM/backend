import { ActivityDTO } from '../dto/response/ActivityDTO';
import { Activity } from '../entities/Activity';

/**
 * ActivityMapper - Maps raw database rows to canonical ActivityDTO.
 * HIPAA COMPLIANCE: Only operational fields, NO PHI.
 */
export class ActivityMapper {
  private static isUuidLike(value: unknown): boolean {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private static getCreatorDisplayName(activity: Activity, meta: Record<string, unknown>): string {
    const entityName = typeof activity.createdByName === 'string' ? activity.createdByName.trim() : '';
    const metaName = typeof meta.createdByName === 'string' ? meta.createdByName.trim() : '';
    const candidate = entityName || metaName;
    if (!candidate) return 'Staff member';
    if (ActivityMapper.isUuidLike(candidate)) return 'Staff member';
    if (activity.createdBy && candidate === activity.createdBy) return 'Staff member';
    return candidate;
  }

  static isVisibleToClientMetadata(metadata: Record<string, unknown> | undefined | null): boolean {
    if (!metadata || typeof metadata !== 'object') return false;
    return metadata.visibleToClient === true || metadata.visible_to_client === true;
  }

  /**
   * Maps a Cloud SQL Activity entity to ActivityDTO (canonical list/detail).
   */
  static fromCloudActivity(activity: Activity): ActivityDTO {
    const meta =
      activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
        ? (activity.metadata as Record<string, unknown>)
        : {};
    const ts = activity.timestamp instanceof Date ? activity.timestamp : new Date(activity.timestamp);
    const createdAt = Number.isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
    return {
      id: activity.id,
      client_id: activity.clientId,
      created_by: activity.createdBy,
      created_by_name: ActivityMapper.getCreatorDisplayName(activity, meta),
      created_by_role:
        activity.createdByRole ??
        (typeof meta.createdByRole === 'string' ? meta.createdByRole : undefined),
      activity_type: activity.type,
      content: activity.description ?? '',
      created_at: createdAt,
      visible_to_client: ActivityMapper.isVisibleToClientMetadata(meta),
      metadata: Object.keys(meta).length > 0 ? meta : undefined,
    };
  }

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
