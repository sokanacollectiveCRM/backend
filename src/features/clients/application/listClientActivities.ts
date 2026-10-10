import { Activity } from '../../../entities/Activity';
import {
  isActivityVisibleToClient,
  isClientActivitiesListUnavailable,
} from '../domain/activity';
import { ActivityRepository } from './activityRepository';

export type ListClientActivitiesError =
  | 'MISSING_CLIENT_ID'
  | 'CLIENT_NOT_FOUND'
  | 'ACTIVITIES_UNAVAILABLE';

export type ListClientActivitiesResult =
  | { ok: true; activities: Activity[] }
  | { ok: false; error: ListClientActivitiesError };

export interface ListClientActivitiesInput {
  tenantId: string;
  clientId: unknown;
  viewerRole?: string;
}

/**
 * Lists notes for one client. A client viewer only receives notes marked
 * visible. Staff viewers receive every note. Authorization stays in HTTP.
 */
export async function listClientActivities(
  input: ListClientActivitiesInput,
  repo: ActivityRepository
): Promise<ListClientActivitiesResult> {
  if (!input.clientId || typeof input.clientId !== 'string') {
    return { ok: false, error: 'MISSING_CLIENT_ID' };
  }

  try {
    const exists = await repo.clientExists(input.clientId, input.tenantId);
    if (!exists) {
      return { ok: false, error: 'CLIENT_NOT_FOUND' };
    }

    const activities = await repo.listByClient(input.clientId, input.tenantId);
    if (input.viewerRole === 'client') {
      return {
        ok: true,
        activities: activities.filter((activity) =>
          isActivityVisibleToClient(
            activity.metadata as Record<string, unknown> | undefined
          )
        ),
      };
    }
    return { ok: true, activities };
  } catch (error) {
    if (isClientActivitiesListUnavailable(error)) {
      return { ok: false, error: 'ACTIVITIES_UNAVAILABLE' };
    }
    throw error;
  }
}
