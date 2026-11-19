import {
  AssignedDoulaRecord,
  DoulaAvailabilitySnapshot,
  ListAssignedDoulasDeps,
  listAssignedDoulas,
} from './listAssignedDoulas';

const clientId = '123e4567-e89b-12d3-a456-426614174001';
const doulaId = '123e4567-e89b-12d3-a456-426614174002';

function record(
  schedulingUrl: string | null = 'https://calendar.example.com/avery'
): AssignedDoulaRecord {
  return {
    id: `${clientId}:${doulaId}`,
    doulaId,
    services: ['Labor Support'],
    assignedAt: new Date('2026-06-01T00:00:00.000Z'),
    role: 'primary',
    status: 'active',
    doula: {
      id: doulaId,
      firstname: 'Avery',
      lastname: 'Jones',
      email: 'avery@example.com',
      scheduling_url: schedulingUrl,
    },
  };
}

function deps(
  overrides?: Partial<ListAssignedDoulasDeps>
): ListAssignedDoulasDeps {
  return {
    getAssignedDoulas: jest.fn().mockResolvedValue([record()]),
    getAvailabilityStatusForDoulas: jest.fn().mockResolvedValue(new Map()),
    isClientInContractStage: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('listAssignedDoulas', () => {
  it('does not read when the client id is missing', async () => {
    const repository = deps();
    const result = await listAssignedDoulas(repository, { clientId: '' });
    expect(result).toEqual({ ok: false, error: 'MISSING_CLIENT_ID' });
    expect(repository.getAssignedDoulas).not.toHaveBeenCalled();
  });

  it('shows the scheduling link to an admin without a contract-stage lookup', async () => {
    const repository = deps();
    const result = await listAssignedDoulas(repository, {
      clientId,
      viewerRole: 'admin',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doulas[0].doula.scheduling_url).toBe(
      'https://calendar.example.com/avery'
    );
    expect(repository.isClientInContractStage).not.toHaveBeenCalled();
  });

  it('hides the link from a client who is not in the contract stage', async () => {
    const repository = deps();
    const result = await listAssignedDoulas(repository, {
      clientId,
      viewerRole: 'client',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doulas[0].doula.scheduling_url).toBeNull();
    expect(repository.isClientInContractStage).toHaveBeenCalledWith(clientId);
  });

  it('shows the link to a client in the contract stage', async () => {
    const repository = deps({
      isClientInContractStage: jest.fn().mockResolvedValue(true),
    });
    const result = await listAssignedDoulas(repository, {
      clientId,
      viewerRole: 'client',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doulas[0].doula.scheduling_url).toBe(
      'https://calendar.example.com/avery'
    );
  });

  it('hides the link from a doula', async () => {
    const repository = deps();
    const result = await listAssignedDoulas(repository, {
      clientId,
      viewerRole: 'doula',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doulas[0].doula.scheduling_url).toBeNull();
    expect(repository.isClientInContractStage).not.toHaveBeenCalled();
  });

  it('uses the availability row when one exists and defaults otherwise', async () => {
    const snapshot: DoulaAvailabilitySnapshot = {
      status: 'unavailable',
      reason: 'vacation',
      startAt: '2026-06-20T10:00:00.000Z',
      endAt: '2026-06-20T12:00:00.000Z',
    };
    const repository = deps({
      getAvailabilityStatusForDoulas: jest
        .fn()
        .mockResolvedValue(new Map([[doulaId, snapshot]])),
    });
    const result = await listAssignedDoulas(repository, {
      clientId,
      viewerRole: 'admin',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doulas[0].availabilityStatus).toEqual(snapshot);
  });

  it('returns ASSIGNMENTS_UNAVAILABLE when the table is missing', async () => {
    const repository = deps({
      getAssignedDoulas: jest
        .fn()
        .mockRejectedValue(
          new Error('relation "doula_assignments" does not exist')
        ),
    });
    const result = await listAssignedDoulas(repository, {
      clientId,
      viewerRole: 'admin',
    });
    expect(result).toEqual({ ok: false, error: 'ASSIGNMENTS_UNAVAILABLE' });
    expect(repository.getAvailabilityStatusForDoulas).not.toHaveBeenCalled();
  });

  it('rethrows errors that are not a missing table', async () => {
    const repository = deps({
      getAssignedDoulas: jest
        .fn()
        .mockRejectedValue(new Error('connection reset')),
    });
    await expect(
      listAssignedDoulas(repository, { clientId, viewerRole: 'admin' })
    ).rejects.toThrow('connection reset');
  });
});
