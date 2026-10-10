import { Activity } from '../../../entities/Activity';
import {
  CreateActivityErrorCode,
  CreateActivityInput,
  isClientActivitiesTableMissing,
  parseCreateActivityCommand,
} from '../domain/activity';
import { ActivityRepository } from './activityRepository';

export type CreateActivityResult =
  | { ok: true; activity: Activity }
  | { ok: false; error: CreateActivityErrorCode };

/**
 * Creates a client activity note.
 * Validation matches the historical controller checks. Authorization stays
 * in the HTTP layer so a failed body still returns 400 before a role check.
 */
export async function createActivity(
  input: CreateActivityInput,
  repo: ActivityRepository
): Promise<CreateActivityResult> {
  const parsed = parseCreateActivityCommand(input);
  if ('error' in parsed) {
    return { ok: false, error: parsed.error };
  }

  const { command } = parsed;
  const exists = await repo.clientExists(command.clientId, command.tenantId);
  if (!exists) {
    return { ok: false, error: 'CLIENT_NOT_FOUND' };
  }

  try {
    const activity = await repo.insert({
      clientId: command.clientId,
      type: command.activityType,
      description: command.content,
      metadata: {
        ...command.metadata,
        visibleToClient: command.visibleToClient,
        createdByName: command.authorName,
        createdByRole: command.authorRole,
      },
      timestamp: new Date(),
      createdBy: command.authorId,
    });
    return { ok: true, activity };
  } catch (error) {
    if (isClientActivitiesTableMissing(error)) {
      return { ok: false, error: 'ACTIVITIES_UNAVAILABLE' };
    }
    throw error;
  }
}
