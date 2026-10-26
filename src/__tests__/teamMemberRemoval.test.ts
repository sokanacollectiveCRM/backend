import { getPool } from '../db/cloudSqlPool';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { getFirebaseAuth } from '../services/identityPlatform/firebaseAdmin';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: jest.fn(),
}));
const query = jest.fn(),
  release = jest.fn();
let table = 'doulas',
  status = 'active',
  grants = false,
  remaining = true;
beforeEach(() => {
  jest.resetAllMocks();
  table = 'doulas';
  status = 'active';
  grants = false;
  remaining = true;
  (getPool as jest.Mock).mockReturnValue({
    connect: async () => ({ query, release }),
  });
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT id,'))
      return {
        rows: sql.includes('public.' + table)
          ? [
              {
                id: 'member',
                email: 'fixture@example.test',
                identity_platform_uid: 'shared-platform-uid',
              },
            ]
          : [],
      };
    if (sql.startsWith('SELECT status')) return { rows: [{ status }] };
    if (sql.startsWith('SELECT department'))
      return { rows: grants ? [{ department: 'hr' }] : [] };
    if (sql.includes('SELECT 1 FROM public.doula_hr_permissions p JOIN'))
      return { rows: remaining ? [{}] : [], rowCount: remaining ? 1 : 0 };
    return { rows: [], rowCount: 1 };
  });
});
it.each(['doulas', 'admins'])(
  'removes only the organization membership for %s, retaining identity and profile',
  async (name) => {
    table = name;
    expect(
      await new CloudSqlTeamService().deleteTeamMember(
        'member',
        'tenant',
        'actor'
      )
    ).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DO UPDATE SET status='inactive'"),
      expect.arrayContaining(['tenant', 'member', 'shared-platform-uid'])
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.staff_membership_events'),
      ['tenant', 'member', 'actor']
    );
    expect(
      query.mock.calls.some(([sql]) =>
        /DELETE FROM public\.(doulas|admins|doula_documents)/.test(sql)
      )
    ).toBe(false);
    expect(getFirebaseAuth).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  }
);
it('is idempotent for an already removed membership', async () => {
  status = 'inactive';
  await new CloudSqlTeamService().deleteTeamMember('member', 'tenant');
  expect(query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  expect(getFirebaseAuth).not.toHaveBeenCalled();
});
it('rolls back membership removal if its audit fails', async () => {
  const original = query.getMockImplementation()!;
  query.mockImplementation(async (sql: string, ...args: unknown[]) => {
    if (sql.includes('INSERT INTO public.staff_membership_events'))
      throw Error('audit failed');
    return original(sql, ...args);
  });
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
  ).rejects.toThrow('audit failed');
  expect(query).toHaveBeenCalledWith('ROLLBACK');
  expect(query).not.toHaveBeenCalledWith('COMMIT');
  expect(getFirebaseAuth).not.toHaveBeenCalled();
});
it('blocks removal of the last HR/payroll holder', async () => {
  grants = true;
  remaining = false;
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
  ).rejects.toThrow('last person');
  expect(query).toHaveBeenCalledWith('ROLLBACK');
});
it('revokes and audits capabilities only in the removed organization', async () => {
  grants = true;
  await new CloudSqlTeamService().deleteTeamMember('member', 'tenant', 'actor');
  expect(query).toHaveBeenCalledWith(
    'DELETE FROM public.doula_hr_permissions WHERE tenant_id=$1::uuid AND admin_id=$2',
    ['tenant', 'member']
  );
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO public.staff_permission_events'),
    ['tenant', 'member', 'actor']
  );
});
it('returns false for another organization or unknown member', async () => {
  query.mockResolvedValue({ rows: [], rowCount: 0 });
  expect(
    await new CloudSqlTeamService().deleteTeamMember('member', 'other')
  ).toBe(false);
  expect(query).toHaveBeenCalledWith('ROLLBACK');
  expect(getFirebaseAuth).not.toHaveBeenCalled();
});
it('requires an organization', async () => {
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member')
  ).rejects.toThrow('tenant');
  expect(query).not.toHaveBeenCalled();
});
