import { Activity } from '../../../entities/Activity';
import { ClientRepository } from '../../../repositories/interface/clientRepository';
import {
  ActivityInsert,
  ActivityRepository,
} from '../application/activityRepository';

/**
 * Writer shape of `CloudSqlActivityRepository.createActivity` /
 * `ClientUseCase.createActivity`. The INSERT itself stays in
 * `src/repositories/cloudSqlActivityRepository.ts`.
 */
export interface ClientActivityWrite {
  createActivity(activityData: {
    clientId: string;
    type: string;
    description?: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
    createdBy?: string;
  }): Promise<Activity>;
}

/**
 * Cloud SQL adapter for activity creation.
 *
 * Client lookup reuses `getClientById` (`SELECT ... FROM phi_clients WHERE id = $1`).
 * That query does not add a tenant predicate; when tenancy enforcement is on,
 * the connection session hides other tenants. A row that actually carries
 * `tenant_id` is rejected when it disagrees with the request tenant.
 * Insert reuses the existing `client_activities` INSERT.
 */
export class CloudSqlClientActivityRepository implements ActivityRepository {
  constructor(
    private readonly clients: Pick<ClientRepository, 'getClientById'>,
    private readonly activities: ClientActivityWrite
  ) {}

  async clientExists(clientId: string, tenantId: string): Promise<boolean> {
    const row = (await this.clients.getClientById?.(clientId)) ?? null;
    if (!row) return false;
    const rowTenant = readTenantId(row);
    if (!tenantId || !rowTenant) return true;
    return rowTenant === tenantId;
  }

  async insert(activity: ActivityInsert): Promise<Activity> {
    return this.activities.createActivity({
      clientId: activity.clientId,
      type: activity.type,
      description: activity.description,
      metadata: activity.metadata,
      timestamp: activity.timestamp,
      createdBy: activity.createdBy,
    });
  }
}

function readTenantId(row: object): string {
  const value = (row as { tenant_id?: unknown }).tenant_id;
  return typeof value === 'string' ? value : '';
}
