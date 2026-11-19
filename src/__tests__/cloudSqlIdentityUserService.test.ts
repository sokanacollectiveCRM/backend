import { getPool } from '../db/cloudSqlPool';
import {
  MemoryAuthoritativeRoleLookup,
  resetAuthoritativeRoleLookupForTests,
  setAuthoritativeRoleLookupForTests,
} from '../security/resolveAuthoritativeRole';
import { CloudSqlIdentityUserService } from '../services/identityPlatform/cloudSqlIdentityUserService';
import { loadUserFromIdentityClaims } from '../services/identityPlatform/loadUserFromIdentity';
import { ROLE } from '../types';

jest.mock('../db/cloudSqlPool', () => ({
  getPool: jest.fn(),
}));

const query = jest.fn();
const mockedGetPool = getPool as jest.MockedFunction<typeof getPool>;

const doulaRow = {
  principal_id: '75dd9375-8f53-4752-91b7-b387eb58c480',
  email: 'doula@example.com',
  first_name: 'Dana',
  last_name: 'Doula',
  role: 'doula',
  account_status: 'approved',
  portal_status: null,
  phone_number: '555-0100',
  address: null,
  city: null,
  state: null,
  country: null,
  zip_code: null,
  bio: null,
  profile_picture: null,
};

describe('CloudSqlIdentityUserService', () => {
  beforeEach(() => {
    query.mockReset();
    mockedGetPool.mockReturnValue({ query } as any);
  });

  it('loads the authoritative profile and role from Cloud SQL', async () => {
    query.mockResolvedValueOnce({ rows: [doulaRow] });

    const user = await new CloudSqlIdentityUserService().findUser({
      uid: 'identity-platform-non-uuid',
      email: ' DOULA@EXAMPLE.COM ',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('identity_platform_uid'),
      ['identity-platform-non-uuid', null, 'doula@example.com']
    );
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('user_id::text = $2::text');
    expect(sql).not.toContain('$2::uuid');
    expect(user).toMatchObject({
      id: doulaRow.principal_id,
      email: doulaRow.email,
      firstname: 'Dana',
      lastname: 'Doula',
      role: ROLE.DOULA,
      account_status: 'approved',
    });
  });

  it('falls back to UUID/email resolution during a rolling schema migration', async () => {
    query
      .mockRejectedValueOnce({
        code: '42703',
        message: 'column d.identity_platform_uid does not exist',
      })
      .mockResolvedValueOnce({ rows: [doulaRow] });

    const user = await new CloudSqlIdentityUserService().findUser({
      uid: doulaRow.principal_id,
      email: doulaRow.email,
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).not.toContain('identity_platform_uid');
    expect(query.mock.calls[1][0]).not.toContain('$3');
    expect(query.mock.calls[1][1]).toEqual([
      doulaRow.principal_id,
      doulaRow.email,
    ]);
    expect(user?.role).toBe(ROLE.DOULA);
  });

  it('does not hide Cloud SQL failures unrelated to the rolling migration', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      new CloudSqlIdentityUserService().findUser({ uid: 'uid-1' })
    ).rejects.toThrow('connection refused');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('resolves activity creator names from Cloud SQL staff records', async () => {
    query.mockResolvedValueOnce({ rows: [doulaRow] });

    await expect(
      new CloudSqlIdentityUserService().findStaffByIdentifier(
        doulaRow.principal_id
      )
    ).resolves.toEqual({
      id: doulaRow.principal_id,
      name: 'Dana Doula',
      email: doulaRow.email,
      role: 'doula',
    });
  });
});

describe('loadUserFromIdentityClaims', () => {
  beforeEach(() => {
    query.mockReset();
    mockedGetPool.mockReturnValue({ query } as any);
    resetAuthoritativeRoleLookupForTests();
  });

  afterEach(() => {
    resetAuthoritativeRoleLookupForTests();
  });

  it('defaults an authenticated but unlinked principal to client without Supabase', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      loadUserFromIdentityClaims({
        uid: 'unlinked-identity-uid',
        email: 'client@example.com',
      })
    ).resolves.toMatchObject({
      id: 'unlinked-identity-uid',
      email: 'client@example.com',
      role: ROLE.CLIENT,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('grants admin when findUser misses but identity_platform_uid matches Cloud SQL', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    setAuthoritativeRoleLookupForTests(
      new MemoryAuthoritativeRoleLookup({
        admins: [
          {
            id: '528e4d28-b24a-47f1-a66b-d7ddd507b7b9',
            email: 'hello+isolated@sokanacollective.com',
            identityPlatformUid: 'F2Bjj6GdBsXTIKKzEmuBe7lQcBC3',
          },
        ],
      })
    );

    await expect(
      loadUserFromIdentityClaims({
        uid: 'F2Bjj6GdBsXTIKKzEmuBe7lQcBC3',
        email: 'hello+isolated@sokanacollective.com',
      })
    ).resolves.toMatchObject({
      id: 'F2Bjj6GdBsXTIKKzEmuBe7lQcBC3',
      role: ROLE.ADMIN,
    });
  });

  it('upgrades a client profile to admin when Cloud SQL admins match the Identity UID', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          principal_id: 'client-row-1',
          email: 'hello+isolated@sokanacollective.com',
          first_name: 'Test',
          last_name: 'Admin',
          role: 'client',
          account_status: 'active',
          portal_status: 'active',
          phone_number: null,
          address: null,
          city: null,
          state: null,
          country: null,
          zip_code: null,
          bio: null,
          profile_picture: null,
        },
      ],
    });
    setAuthoritativeRoleLookupForTests(
      new MemoryAuthoritativeRoleLookup({
        admins: [
          {
            id: '528e4d28-b24a-47f1-a66b-d7ddd507b7b9',
            email: 'hello+isolated@sokanacollective.com',
            identityPlatformUid: 'F2Bjj6GdBsXTIKKzEmuBe7lQcBC3',
          },
        ],
      })
    );

    await expect(
      loadUserFromIdentityClaims({
        uid: 'F2Bjj6GdBsXTIKKzEmuBe7lQcBC3',
        email: 'hello+isolated@sokanacollective.com',
      })
    ).resolves.toMatchObject({
      id: 'client-row-1',
      role: ROLE.ADMIN,
    });
  });
});
