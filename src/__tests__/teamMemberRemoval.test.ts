import { removeTeamMember } from '../features/team/application/removeTeamMember';
import { runWithTenant } from '../features/tenancy/application/tenantRequestStore';

const mockQuery = jest.fn();
const mockSharedQuery = jest.fn();
const mockRelease = jest.fn();
const mockGetUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('../db/cloudSqlPool', () => ({
  getPool: () => ({
    connect: async () => ({ query: mockQuery, release: mockRelease }),
    query: mockSharedQuery,
  }),
}));
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: () => ({
    getUser: mockGetUser,
    getUserByEmail: mockGetUserByEmail,
    deleteUser: mockDeleteUser,
  }),
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const originalDatabase = process.env.CLOUD_SQL_DATABASE;
let pending: boolean;
let member: boolean;
let admin: boolean;
let foreignKeyFailure: boolean;
const remove = () => runWithTenant(tenantId, () => removeTeamMember(memberId));
const statements = () => mockQuery.mock.calls.map(([sql]) => sql as string);

beforeEach(() => {
  jest.resetAllMocks();
  process.env.CLOUD_SQL_DATABASE = 'sokana_private_dev';
  pending = false;
  member = true;
  admin = false;
  foreignKeyFailure = false;
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT id FROM public.staff_invitations')) {
      return {
        rowCount: pending ? 1 : 0,
        rows: pending ? [{ id: memberId }] : [],
      };
    }
    if (sql.startsWith('SELECT id, email')) {
      const found = sql.includes('public.doulas') ? member : admin;
      return {
        rowCount: found ? 1 : 0,
        rows: found
          ? [
              {
                id: memberId,
                email: 'fictional@example.com',
                identity_platform_uid: 'test-uid',
              },
            ]
          : [],
      };
    }
    if (foreignKeyFailure && sql.startsWith('DELETE FROM public.doulas')) {
      throw new Error('foreign key constraint');
    }
    return { rowCount: 1, rows: [] };
  });
  mockSharedQuery.mockResolvedValue({ rows: [{ referenced: false }] });
  mockGetUser.mockResolvedValue({
    uid: 'test-uid',
    customClaims: { sokanaAccountDatabase: 'sokana_private_dev' },
  });
  mockDeleteUser.mockResolvedValue(undefined);
});

afterAll(() => {
  if (originalDatabase === undefined) delete process.env.CLOUD_SQL_DATABASE;
  else process.env.CLOUD_SQL_DATABASE = originalDatabase;
});

it('deletes a pending invitation and its events without touching Firebase', async () => {
  pending = true;
  expect(await remove()).toBe(true);
  expect(
    statements().some((s) =>
      s.startsWith('DELETE FROM public.staff_invitation_events')
    )
  ).toBe(true);
  expect(mockGetUser).not.toHaveBeenCalled();
  expect(mockDeleteUser).not.toHaveBeenCalled();
  expect(statements()).toContain('COMMIT');
});

it('removes organization records while preserving the Firebase identity', async () => {
  expect(await remove()).toBe(true);
  for (const table of [
    'doulas',
    'memberships',
    'staff_invitation_events',
    'staff_invitations',
  ]) {
    expect(
      statements().some((s) => s.startsWith(`DELETE FROM public.${table}`))
    ).toBe(true);
  }
  expect(mockGetUser).not.toHaveBeenCalled();
  expect(mockDeleteUser).not.toHaveBeenCalled();
  expect(
    mockQuery.mock.calls
      .filter(([sql]) => sql.startsWith('DELETE'))
      .every(
        ([sql, args]) => sql.includes('tenant_id') && args.includes(tenantId)
      )
  ).toBe(true);
  expect(mockRelease).toHaveBeenCalled();
});

it('also removes accepted admin accounts', async () => {
  member = false;
  admin = true;
  expect(await remove()).toBe(true);
  expect(
    statements().some((s) => s.startsWith('DELETE FROM public.admins'))
  ).toBe(true);
  expect(mockGetUser).not.toHaveBeenCalled();
  expect(mockDeleteUser).not.toHaveBeenCalled();
});

it('keeps a Firebase identity referenced by another account or membership', async () => {
  mockSharedQuery.mockResolvedValue({ rows: [{ referenced: true }] });
  expect(await remove()).toBe(true);
  expect(mockDeleteUser).not.toHaveBeenCalled();
});

it.each([
  {},
  { sokanaAccountDatabase: 'sokana_private' },
  { sokanaAccountDatabase: 'sokana_private_dev' },
])(
  'removes organization access regardless of identity ownership: %j',
  async (customClaims) => {
    mockGetUser.mockResolvedValue({ uid: 'test-uid', customClaims });
    expect(await remove()).toBe(true);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSharedQuery).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(statements()).toContain('COMMIT');
  }
);

it('does not delete Firebase when related records prevent database removal', async () => {
  foreignKeyFailure = true;
  await expect(remove()).rejects.toThrow('foreign key');
  expect(mockDeleteUser).not.toHaveBeenCalled();
  expect(statements()).toContain('ROLLBACK');
  expect(statements()).not.toContain('COMMIT');
});

it('allows retry if the Firebase identity has already been deleted', async () => {
  mockGetUser.mockRejectedValue({ code: 'auth/user-not-found' });
  expect(await remove()).toBe(true);
  expect(mockDeleteUser).not.toHaveBeenCalled();
  expect(statements()).toContain('COMMIT');
});

it('returns not found for an unknown or other-tenant id', async () => {
  member = false;
  expect(await remove()).toBe(false);
  expect(mockDeleteUser).not.toHaveBeenCalled();
  expect(statements()).not.toContain('COMMIT');
});

it('requires explicit tenant context', async () => {
  await expect(removeTeamMember(memberId)).rejects.toThrow(
    'A tenant is required'
  );
  expect(mockQuery).not.toHaveBeenCalled();
});
