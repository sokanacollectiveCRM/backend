import {
  UnassignDoulaDeps,
  unassignDoulaFromClient,
} from './unassignDoulaFromClient';

const clientId = '123e4567-e89b-12d3-a456-426614174001';
const doulaId = '123e4567-e89b-12d3-a456-426614174002';

describe('unassignDoulaFromClient', () => {
  it('does not write when either id is missing', async () => {
    const deps: UnassignDoulaDeps = {
      unassignDoula: jest.fn(),
    };
    const result = await unassignDoulaFromClient(deps, { clientId });
    expect(result).toEqual({ ok: false, error: 'MISSING_IDS' });
    expect(deps.unassignDoula).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when no active assignment is removed', async () => {
    const deps: UnassignDoulaDeps = {
      unassignDoula: jest.fn().mockResolvedValue(false),
    };
    const result = await unassignDoulaFromClient(deps, { clientId, doulaId });
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('returns ok when the assignment is cancelled', async () => {
    const deps: UnassignDoulaDeps = {
      unassignDoula: jest.fn().mockResolvedValue(true),
    };
    const result = await unassignDoulaFromClient(deps, { clientId, doulaId });
    expect(result).toEqual({ ok: true });
    expect(deps.unassignDoula).toHaveBeenCalledWith(clientId, doulaId);
  });

  it('lets a missing-table error propagate', async () => {
    const deps: UnassignDoulaDeps = {
      unassignDoula: jest
        .fn()
        .mockRejectedValue(
          new Error('relation "doula_assignments" does not exist')
        ),
    };
    await expect(
      unassignDoulaFromClient(deps, { clientId, doulaId })
    ).rejects.toThrow('does not exist');
  });
});
