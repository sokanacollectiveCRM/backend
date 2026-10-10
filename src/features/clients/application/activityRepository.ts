import { Activity } from '../../../entities/Activity';

export interface ActivityInsert {
  clientId: string;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  createdBy: string;
}

/**
 * Persistence port for creating one client activity.
 * Both methods are tenant-scoped: callers pass the request tenant id.
 */
export interface ActivityRepository {
  clientExists(clientId: string, tenantId: string): Promise<boolean>;
  insert(activity: ActivityInsert): Promise<Activity>;
  listByClient(clientId: string, tenantId: string): Promise<Activity[]>;
}
