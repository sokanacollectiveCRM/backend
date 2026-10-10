import { Activity } from '../../../entities/Activity';
import { CreateActivityInput } from '../domain/activity';
import { ActivityInsert, ActivityRepository } from './activityRepository';
import { createActivity } from './createActivity';

const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const clientId = '123e4567-e89b-12d3-a456-426614174010';

class MemoryActivityRepository implements ActivityRepository {
  readonly inserts: ActivityInsert[] = [];
  failInsert: Error | null = null;

  constructor(private readonly clients: { id: string; tenantId: string }[]) {}

  async clientExists(id: string, tenantId: string): Promise<boolean> {
    return this.clients.some(
      (client) => client.id === id && client.tenantId === tenantId
    );
  }

  async listByClient(): Promise<Activity[]> {
    return [];
  }

  async insert(activity: ActivityInsert): Promise<Activity> {
    if (this.failInsert) throw this.failInsert;
    this.inserts.push(activity);
    return new Activity(
      'act-1',
      activity.clientId,
      activity.type,
      activity.description,
      activity.metadata,
      activity.timestamp,
      activity.createdBy,
      typeof activity.metadata.createdByName === 'string'
        ? activity.metadata.createdByName
        : undefined,
      typeof activity.metadata.createdByRole === 'string'
        ? activity.metadata.createdByRole
        : undefined
    );
  }
}

function input(
  overrides: Partial<CreateActivityInput> = {}
): CreateActivityInput {
  return {
    tenantId: tenantA,
    clientId,
    authorId: 'admin-1',
    authorFirstName: 'Ada',
    authorLastName: 'Admin',
    authorEmail: 'ada.admin@example.com',
    authorRole: 'admin',
    activityType: 'note',
    content: 'Visit note',
    metadata: { category: 'general' },
    visibleToClient: undefined,
    visibleToClientSnake: undefined,
    ...overrides,
  };
}

describe('createActivity', () => {
  it('stores a trimmed note for the request tenant', async () => {
    const repo = new MemoryActivityRepository([
      { id: clientId, tenantId: tenantA },
    ]);

    const result = await createActivity(
      input({
        activityType: '  note  ',
        content: '  Visit note  ',
        metadata: { category: 'general', visibleToClient: false },
        visibleToClientSnake: 'true',
      }),
      repo
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activity.clientId).toBe(clientId);
    expect(result.activity.type).toBe('note');
    expect(result.activity.description).toBe('Visit note');
    expect(repo.inserts).toHaveLength(1);
    expect(repo.inserts[0]).toEqual(
      expect.objectContaining({
        clientId,
        type: 'note',
        description: 'Visit note',
        createdBy: 'admin-1',
        metadata: {
          category: 'general',
          visibleToClient: true,
          createdByName: 'Ada Admin',
          createdByRole: 'admin',
        },
      })
    );
    expect(repo.inserts[0].timestamp).toBeInstanceOf(Date);
  });

  it.each([
    ['missing client id', { clientId: '' }, 'MISSING_CLIENT_ID'],
    ['blank activity type', { activityType: '  ' }, 'INVALID_ACTIVITY_TYPE'],
    ['numeric activity type', { activityType: 4 }, 'INVALID_ACTIVITY_TYPE'],
    ['blank content', { content: ' ' }, 'INVALID_CONTENT'],
    ['non-string content', { content: { text: 'nope' } }, 'INVALID_CONTENT'],
  ] as const)(
    'returns %s without writing',
    async (_label, overrides, error) => {
      const repo = new MemoryActivityRepository([
        { id: clientId, tenantId: tenantA },
      ]);

      const result = await createActivity(input(overrides), repo);

      expect(result).toEqual({ ok: false, error });
      expect(repo.inserts).toHaveLength(0);
    }
  );

  it('returns CLIENT_NOT_FOUND when the client is missing', async () => {
    const repo = new MemoryActivityRepository([]);

    const result = await createActivity(input(), repo);

    expect(result).toEqual({ ok: false, error: 'CLIENT_NOT_FOUND' });
    expect(repo.inserts).toHaveLength(0);
  });

  it('does not write a client that belongs to another tenant', async () => {
    const repo = new MemoryActivityRepository([
      { id: clientId, tenantId: tenantB },
    ]);

    const result = await createActivity(input({ tenantId: tenantA }), repo);

    expect(result).toEqual({ ok: false, error: 'CLIENT_NOT_FOUND' });
    expect(repo.inserts).toHaveLength(0);
  });

  it('ignores metadata that is not a plain object and names the author from email', async () => {
    const repo = new MemoryActivityRepository([
      { id: clientId, tenantId: tenantA },
    ]);

    await createActivity(
      input({
        metadata: ['skip'],
        authorFirstName: '',
        authorLastName: null,
        authorRole: '',
      }),
      repo
    );

    expect(repo.inserts[0].metadata).toEqual({
      visibleToClient: false,
      createdByName: 'ada.admin@example.com',
      createdByRole: 'staff',
    });
  });

  it('returns ACTIVITIES_UNAVAILABLE when the activities table is missing', async () => {
    const repo = new MemoryActivityRepository([
      { id: clientId, tenantId: tenantA },
    ]);
    repo.failInsert = new Error(
      'Could not find the table public.client_activities in the schema cache'
    );

    const result = await createActivity(input(), repo);

    expect(result).toEqual({ ok: false, error: 'ACTIVITIES_UNAVAILABLE' });
  });

  it('rethrows persistence errors that are not a missing table', async () => {
    const repo = new MemoryActivityRepository([
      { id: clientId, tenantId: tenantA },
    ]);
    repo.failInsert = new Error('connection reset');

    await expect(createActivity(input(), repo)).rejects.toThrow(
      'connection reset'
    );
  });
});
