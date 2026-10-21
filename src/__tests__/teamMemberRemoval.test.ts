import { getPool } from '../db/cloudSqlPool';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { getFirebaseAuth } from '../services/identityPlatform/firebaseAdmin';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: jest.fn(),
}));
const query = jest.fn();
const release = jest.fn();
const deleteUser = jest.fn();
const getUserByEmail = jest.fn();
let role: 'doulas' | 'admins';
let uid: string | null;
let shared: boolean;
beforeEach(() => {
  jest.resetAllMocks();
  role = 'doulas';
  uid = 'firebase-uid';
  shared = false;
  (getPool as jest.Mock).mockReturnValue({
    connect: async () => ({ query, release }),
  });
  (getFirebaseAuth as jest.Mock).mockReturnValue({
    deleteUser,
    getUserByEmail,
  });
  getUserByEmail.mockResolvedValue({ uid: 'legacy-uid' });
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT id'))
      return {
        rows: sql.includes('public.' + role)
          ? [
              {
                id: 'member',
                email: 'maya@example.com',
                identity_platform_uid: uid,
              },
            ]
          : [],
      };
    if (sql.startsWith('SELECT EXISTS')) return { rows: [{ shared }] };
    return { rows: [], rowCount: 1 };
  });
});
it.each(['doulas', 'admins'] as const)(
  'removes %s identity before committing SQL',
  async (target) => {
    role = target;
    expect(
      await new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
    ).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith('firebase-uid');
    const commit = query.mock.calls.findIndex(([sql]) => sql === 'COMMIT');
    expect(deleteUser.mock.invocationCallOrder[0]).toBeLessThan(
      query.mock.invocationCallOrder[commit]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $2::uuid FOR UPDATE'),
      ['member', 'tenant']
    );
    expect(release).toHaveBeenCalled();
  }
);
it('looks up legacy identities by email', async () => {
  uid = null;
  await new CloudSqlTeamService().deleteTeamMember('member', 'tenant');
  expect(getUserByEmail).toHaveBeenCalledWith('maya@example.com');
  expect(deleteUser).toHaveBeenCalledWith('legacy-uid');
});
it('rolls back when Firebase deletion fails', async () => {
  deleteUser.mockRejectedValue(new Error('permission denied'));
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
  ).rejects.toThrow('permission denied');
  expect(query).toHaveBeenCalledWith('ROLLBACK');
  expect(query).not.toHaveBeenCalledWith('COMMIT');
});
it('does not delete Firebase when SQL dependencies prevent removal', async () => {
  const original = query.getMockImplementation()!;
  query.mockImplementation(async (sql: string, ...args: unknown[]) => {
    if (sql.startsWith('DELETE FROM public.doulas'))
      throw new Error('foreign key');
    return original(sql, ...args);
  });
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
  ).rejects.toThrow('foreign key');
  expect(deleteUser).not.toHaveBeenCalled();
});
it('treats an already missing Firebase identity as successfully removed', async () => {
  deleteUser.mockRejectedValue({ code: 'auth/user-not-found' });
  expect(
    await new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
  ).toBe(true);
});
it('protects identities shared with other profiles', async () => {
  shared = true;
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member', 'tenant')
  ).rejects.toThrow('another profile');
  expect(deleteUser).not.toHaveBeenCalled();
});
it('does not remove identities for missing or wrong-tenant members', async () => {
  query.mockResolvedValue({ rows: [] });
  expect(
    await new CloudSqlTeamService().deleteTeamMember('member', 'other')
  ).toBe(false);
  expect(deleteUser).not.toHaveBeenCalled();
});
it('requires tenant context', async () => {
  await expect(
    new CloudSqlTeamService().deleteTeamMember('member')
  ).rejects.toThrow('tenant');
  expect(query).not.toHaveBeenCalled();
});
