import { Activity } from '../../entities/Activity';

export interface ActivityRepository {
  /**
   * Create a new activity log entry
   */
  createActivity(activityData: {
    clientId: string;
    type: string;
    description?: string;
    metadata?: any;
    timestamp: Date;
    createdBy?: string;
  }): Promise<Activity>;

  /**
   * Get activities for a specific client
   */
  getActivitiesByClientId(clientId: string): Promise<Activity[]>;

  /**
   * Get all activities (admin only)
   */
  getAllActivities(): Promise<Activity[]>;

  /**
   * Merge keys into metadata for a row scoped by client (returns null if no row updated).
   */
  updateActivityMetadataMerge(
    activityId: string,
    clientId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<Activity | null>;
}