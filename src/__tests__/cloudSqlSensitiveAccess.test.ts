import { CloudSqlDoulaAssignmentService } from '../services/cloudSqlDoulaAssignmentService';
import { canAccessSensitive } from '../utils/sensitiveAccess';

const query = jest.fn();

jest.mock('../db/cloudSqlPool', () => ({
  getPool: () => ({ query }),
}));

describe('Cloud SQL assignment authorization', () => {
  beforeEach(() => query.mockReset());

  it('allows a doula only for an active Cloud SQL assignment', async () => {
    query.mockResolvedValue({
      rows: [{ client_id: 'client-1' }, { client_id: 'client-2' }],
    });

    await expect(
      canAccessSensitive({ id: 'doula-1', role: 'doula' }, 'client-2')
    ).resolves.toEqual({
      canAccess: true,
      assignedClientIds: ['client-1', 'client-2'],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'active'"),
      ['doula-1']
    );
  });

  it('denies a doula when no active Cloud SQL assignment exists', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(
      canAccessSensitive({ id: 'doula-1', role: 'doula' }, 'client-1')
    ).resolves.toEqual({ canAccess: false, assignedClientIds: [] });
  });

  it('fails closed when Cloud SQL assignment lookup fails', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    await expect(
      canAccessSensitive({ id: 'doula-1', role: 'doula' }, 'client-1')
    ).resolves.toEqual({ canAccess: false, assignedClientIds: [] });
  });

  it('allows admins without an assignment lookup and denies other roles', async () => {
    await expect(
      canAccessSensitive({ id: 'admin-1', role: 'admin' }, 'client-1')
    ).resolves.toEqual({ canAccess: true, assignedClientIds: [] });
    await expect(
      canAccessSensitive({ id: 'billing-1', role: 'billing' }, 'client-1')
    ).resolves.toEqual({ canAccess: false, assignedClientIds: [] });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('Cloud SQL assignment lifecycle', () => {
  const service = new CloudSqlDoulaAssignmentService();

  beforeEach(() => query.mockReset());

  it('checks only active assignments', async () => {
    query.mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] });
    await expect(service.assignmentExists('client-1', 'doula-1')).resolves.toBe(
      true
    );
    expect(query.mock.calls[0][0]).toContain("status = 'active'");
  });

  it('soft-revokes instead of deleting an assignment', async () => {
    query.mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(service.unassignDoula('client-1', 'doula-1')).resolves.toBe(
      true
    );
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE public.doula_assignments');
    expect(sql).toContain("status = 'cancelled'");
    expect(sql).not.toContain('DELETE FROM');
  });
});
