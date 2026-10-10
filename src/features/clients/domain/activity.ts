/**
 * Pure rules for creating a client activity. No Express, database, or env.
 */

export type CreateActivityErrorCode =
  | 'MISSING_CLIENT_ID'
  | 'INVALID_ACTIVITY_TYPE'
  | 'INVALID_CONTENT'
  | 'CLIENT_NOT_FOUND'
  | 'ACTIVITIES_UNAVAILABLE';

export type CreateActivityValidationError =
  | 'MISSING_CLIENT_ID'
  | 'INVALID_ACTIVITY_TYPE'
  | 'INVALID_CONTENT';

export interface CreateActivityInput {
  tenantId: string;
  clientId: unknown;
  authorId: string;
  authorFirstName?: string | null;
  authorLastName?: string | null;
  authorEmail?: string | null;
  authorRole?: unknown;
  activityType: unknown;
  content: unknown;
  metadata: unknown;
  visibleToClient: unknown;
  visibleToClientSnake: unknown;
}

export interface CreateActivityCommand {
  tenantId: string;
  clientId: string;
  authorId: string;
  activityType: string;
  content: string;
  metadata: Record<string, unknown>;
  visibleToClient: boolean;
  authorName: string;
  authorRole: string;
}

export function activityAuthorName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  return (
    `${input.firstName || ''} ${input.lastName || ''}`.trim() ||
    (input.email || '').trim() ||
    'Staff member'
  );
}

export function activityAuthorRole(role: unknown): string {
  return role ? String(role) : 'staff';
}

export function activityVisibleToClient(
  visibleToClient: unknown,
  visibleToClientSnake: unknown
): boolean {
  return (
    visibleToClient === true ||
    visibleToClientSnake === true ||
    visibleToClient === 'true' ||
    visibleToClientSnake === 'true'
  );
}

export function activityMetadataRecord(
  metadata: unknown
): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

function requiredText(value: unknown): string | null {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
}

export function parseCreateActivityCommand(
  input: CreateActivityInput
):
  | { ok: true; command: CreateActivityCommand }
  | { ok: false; error: CreateActivityValidationError } {
  if (!input.clientId || typeof input.clientId !== 'string') {
    return { ok: false, error: 'MISSING_CLIENT_ID' };
  }

  const activityType = requiredText(input.activityType);
  if (!activityType) {
    return { ok: false, error: 'INVALID_ACTIVITY_TYPE' };
  }

  const content = requiredText(input.content);
  if (!content) {
    return { ok: false, error: 'INVALID_CONTENT' };
  }

  return {
    ok: true,
    command: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      authorId: input.authorId,
      activityType,
      content,
      metadata: activityMetadataRecord(input.metadata),
      visibleToClient: activityVisibleToClient(
        input.visibleToClient,
        input.visibleToClientSnake
      ),
      authorName: activityAuthorName({
        firstName: input.authorFirstName,
        lastName: input.authorLastName,
        email: input.authorEmail,
      }),
      authorRole: activityAuthorRole(input.authorRole),
    },
  };
}

/** Same table-missing detection the controller used for the 503 fallback. */
export function isClientActivitiesTableMissing(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    message.includes('client_activities') &&
    (message.includes('could not find') ||
      message.includes('schema cache') ||
      message.includes('does not exist'))
  );
}
