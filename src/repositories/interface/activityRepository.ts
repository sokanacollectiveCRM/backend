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
} 