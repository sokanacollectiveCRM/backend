import { getPool } from '../db/cloudSqlPool';
import { runWithTenant } from '../features/tenancy/application/tenantRequestStore';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { getFirebaseAuth } from '../services/identityPlatform/firebaseAdmin';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: jest.fn(),
}));
const query = jest.fn(),
  release = jest.fn(),
  createUser = jest.fn(),
  deleteUser = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  query.mockResolvedValue({ rows: [{ id: 'new-member' }] });
  createUser.mockResolvedValue({ uid: 'firebase-uid' });
  (getPool as jest.Mock).mockReturnValue({
    connect: async () => ({ query, release }),
  });
  (getFirebaseAuth as jest.Mock).mockReturnValue({ createUser, deleteUser });
});
const input = {
  firstname: 'Maya',
  lastname: 'Rivers',
  email: 'maya@example.com',
  role: 'doula' as const,
};
it.each(['doula', 'admin'] as const)(
  'links new %s accounts to the inviting organization and Firebase UID',
  async (role) => {
    await runWithTenant('inviting-tenant', () =>
      new CloudSqlTeamService().addTeamMember({ ...input, role })
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.memberships'),
      ['inviting-tenant', role, 'new-member', 'firebase-uid', input.email]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('identity_platform_uid, tenant_id'),
      expect.arrayContaining(['firebase-uid', 'inviting-tenant'])
    );
    if (role === 'doula')
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("'active'"),
        expect.any(Array)
      );
    expect(query).toHaveBeenCalledWith('COMMIT');
  }
);
it('rolls back the profile and Firebase identity if membership creation fails', async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO public.memberships'))
      throw new Error('membership failed');
    return { rows: [{ id: 'new-member' }] };
  });
  await expect(
    runWithTenant('tenant', () =>
      new CloudSqlTeamService().addTeamMember(input)
    )
  ).rejects.toThrow('membership failed');
  expect(query).toHaveBeenCalledWith('ROLLBACK');
  expect(deleteUser).toHaveBeenCalledWith('firebase-uid');
  expect(query).not.toHaveBeenCalledWith('COMMIT');
});
it('fails before creating an identity when organization context is missing', async () => {
  await expect(new CloudSqlTeamService().addTeamMember(input)).rejects.toThrow(
    'organization'
  );
  expect(createUser).not.toHaveBeenCalled();
});
