import { Activity } from '../../../entities/Activity';
import { ActivityRepository } from './activityRepository';
import { listClientActivities } from './listClientActivities';

const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const clientId = '123e4567-e89b-12d3-a456-426614174010';

class MemoryActivityRepository implements ActivityRepository {
  failList: Error | null = null;

  constructor(
    private readonly clients: { id: string; tenantId: string }[],
    private readonly notes: Activity[]
  ) {}

  async clientExists(id: string, tenantId: string): Promise<boolean> {
    return this.clients.some(
      (client) => client.id === id && client.tenantId === tenantId
    );
  }

  async insert(): Promise<Activity> {
    throw new Error('insert is not used by the list');
  }

  async listByClient(id: string): Promise<Activity[]> {
    if (this.failList) throw this.failList;
    return this.notes.filter((note) => note.clientId === id);
  }
}

function note(id: string, metadata: Record<string, unknown>): Activity {
  return new Activity(
    id,
    clientId,
    'note',
    id,
    metadata,
    new Date('2026-04-01T15:00:00.000Z'),
    'admin-1',
    'Ada Admin',
    'admin'
  );
}

describe('listClientActivities', () => {
  const hidden = note('act-hidden', {});
  const visible = note('act-visible', { visibleToClient: true });
  const snake = note('act-snake', { visible_to_client: true });

  function repo() {
    return new MemoryActivityRepository(
      [{ id: clientId, tenantId: tenantA }],
      [hidden, visible, snake]
    );
  }

  it('returns every note for a staff viewer', async () => {
    const result = await listClientActivities(
      { tenantId: tenantA, clientId, viewerRole: 'admin' },
      repo()
    );

    expect(result).toEqual({
      ok: true,
      activities: [hidden, visible, snake],
    });
  });

  it('returns only notes marked visible for a client viewer', async () => {
    const result = await listClientActivities(
      { tenantId: tenantA, clientId, viewerRole: 'client' },
      repo()
    );

    expect(result.ok).toBe(true);
    if (!('activities' in result)) return;
    expect(result.activities.map((activity) => activity.id)).toEqual([
      'act-visible',
      'act-snake',
    ]);
  });

  it('returns MISSING_CLIENT_ID without reading', async () => {
    const store = repo();
    const exists = jest.spyOn(store, 'clientExists');

    const result = await listClientActivities(
      { tenantId: tenantA, clientId: '', viewerRole: 'admin' },
      store
    );

    expect(result).toEqual({ ok: false, error: 'MISSING_CLIENT_ID' });
    expect(exists).not.toHaveBeenCalled();
  });

  it('returns CLIENT_NOT_FOUND when the client is missing', async () => {
    const store = new MemoryActivityRepository([], [hidden]);

    const result = await listClientActivities(
      { tenantId: tenantA, clientId, viewerRole: 'admin' },
      store
    );

    expect(result).toEqual({ ok: false, error: 'CLIENT_NOT_FOUND' });
  });

  it('does not list a client that belongs to another tenant', async () => {
    const store = repo();
    const listed = jest.spyOn(store, 'listByClient');

    const result = await listClientActivities(
      { tenantId: tenantB, clientId, viewerRole: 'doula' },
      store
    );

    expect(result).toEqual({ ok: false, error: 'CLIENT_NOT_FOUND' });
    expect(listed).not.toHaveBeenCalled();
  });

  it('returns ACTIVITIES_UNAVAILABLE when the activities table is missing', async () => {
    const store = repo();
    store.failList = new Error(
      'Could not fetch client activities: relation "client_activities" does not exist'
    );

    const result = await listClientActivities(
      { tenantId: tenantA, clientId, viewerRole: 'admin' },
      store
    );

    expect(result).toEqual({ ok: false, error: 'ACTIVITIES_UNAVAILABLE' });
  });

  it('rethrows other list failures', async () => {
    const store = repo();
    store.failList = new Error('connection reset');

    await expect(
      listClientActivities(
        { tenantId: tenantA, clientId, viewerRole: 'admin' },
        store
      )
    ).rejects.toThrow('connection reset');
  });
});
