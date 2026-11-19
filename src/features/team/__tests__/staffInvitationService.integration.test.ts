/** Run only against a disposable local Postgres instance; no real identities/mail. */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';

import { getPool } from '../../../db/cloudSqlPool';
import { CloudSqlIdentityUserService } from '../../../services/identityPlatform/cloudSqlIdentityUserService';
import { resolveTenantGate, runWithTenant } from '../../tenancy';
import {
  acceptStaffInvitation,
  createStaffInvitation,
  previewStaffInvitation,
} from '../application/staffInvitationService';

const mockIdentities = new Map<string, any>();
const mockVerifyToken = jest.fn();
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockSetClaims = jest.fn();
const mockSendInvite = jest.fn();
const mockSendVerification = jest.fn();
jest.mock('../../../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: () => ({
    getUserByEmail: async (email: string) => {
      const user = mockIdentities.get(email);
      if (!user) throw { code: 'auth/user-not-found' };
      return user;
    },
    createUser: mockCreateUser,
    deleteUser: mockDeleteUser,
    setCustomUserClaims: mockSetClaims,
  }),
}));
jest.mock(
  '../../../services/identityPlatform/identityPlatformTokenService',
  () => ({
    IdentityPlatformTokenService: jest.fn().mockImplementation(() => ({
      verifySessionOrIdToken: mockVerifyToken,
    })),
  })
);
jest.mock('../../../services/emailService', () => ({
  NodemailerService: jest.fn().mockImplementation(() => ({
    sendStaffInvitationEmail: (...args: unknown[]) => mockSendInvite(...args),
  })),
}));
jest.mock(
  '../../../services/identityPlatform/emailVerificationService',
  () => ({
    emailVerificationService: {
      sendVerificationEmailForUid: (...args: unknown[]) =>
        mockSendVerification(...args),
    },
  })
);
jest.mock('../../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'doula@example.test';
const UID = 'shared-doula-login';
const integration = process.env.P07_TEST_PG_SOCKET ? describe : describe.skip;
integration(
  'multi-organization staff invitations with PostgreSQL and enforced RLS',
  () => {
    let owner: Pool;
    let cluster: Pool;
    const database = `p07_test_${process.pid}`;
    let originalId: string;
    const profile = new CloudSqlIdentityUserService();
    const migration = () =>
      readFileSync(
        resolve(
          __dirname,
          '../../../db/migrations/20261024_multitenant_staff_identity.sql'
        ),
        'utf8'
      );

    beforeAll(async () => {
      // Only a Unix socket and an explicitly disposable database are allowed.
      const host = process.env.P07_TEST_PG_SOCKET;
      if (!host || !/^\/(private\/)?tmp\/sokana-p07/.test(host))
        throw new Error('Disposable local socket required');
      cluster = new Pool({
        host,
        port: 55427,
        database: 'postgres',
        user: process.env.USER,
      });
      await cluster.query(
        `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user LOGIN; END IF; END $$`
      );
      await cluster.query(`CREATE DATABASE ${database}`);
      owner = new Pool({ host, port: 55427, database, user: process.env.USER });
      const columns = `id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid,
      full_name text, email text UNIQUE, identity_platform_uid text UNIQUE,
      first_name text, last_name text, phone text, address text, city text, state text,
      country text, zip_code text, bio text, profile_picture text,
      account_status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()`;
      await owner.query(`CREATE TABLE public.admins (${columns}); CREATE TABLE public.doulas (${columns});
      CREATE TABLE public.phi_clients (${columns}, user_id uuid, portal_status text, address_line1 text)`);
      for (const filename of [
        '20261005_tenancy_foundation.sql',
        '20261006_staff_invitations.sql',
      ]) {
        await owner.query(
          readFileSync(
            resolve(__dirname, '../../../db/migrations', filename),
            'utf8'
          )
        );
      }
      await owner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_doulas_email ON doulas (lower(TRIM(BOTH FROM email))) WHERE TRIM(BOTH FROM email) <> ''; CREATE UNIQUE INDEX IF NOT EXISTS uq_doulas_name ON doulas (lower(TRIM(BOTH FROM full_name)))`
      );
      await owner.query(migration());
      await owner.query(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user'
      );
      Object.assign(process.env, {
        CLOUD_SQL_HOST: host,
        CLOUD_SQL_PORT: '55427',
        CLOUD_SQL_DATABASE: database,
        CLOUD_SQL_USER: 'app_user',
        CLOUD_SQL_PASSWORD: 'synthetic-test-only',
        CLOUD_SQL_SSLMODE: 'disable',
        TENANCY_ENFORCE: 'on',
      });
    });

    beforeEach(async () => {
      jest.clearAllMocks();
      mockIdentities.clear();
      mockIdentities.set(EMAIL, {
        uid: UID,
        email: EMAIL,
        emailVerified: true,
        disabled: false,
      });
      mockVerifyToken.mockResolvedValue({ uid: UID, email: EMAIL });
      mockCreateUser.mockImplementation(async (input) => ({
        uid: 'new-login',
        ...input,
      }));
      mockSendInvite.mockResolvedValue(undefined);
      mockDeleteUser.mockResolvedValue(undefined);
      mockSetClaims.mockResolvedValue(undefined);
      await owner.query(
        'TRUNCATE public.staff_invitation_events, public.staff_invitations, public.memberships, public.doulas, public.admins'
      );
      await owner.query("UPDATE public.tenants SET status = 'active'");
      const { rows } = await owner.query(
        `INSERT INTO public.doulas (tenant_id, full_name, email, identity_platform_uid, account_status, bio)
       VALUES ($1, 'Original Organization Profile', $2, $3, 'approved', 'Private org A bio') RETURNING id`,
        [A, EMAIL, UID]
      );
      originalId = rows[0].id;
      await owner.query(
        `INSERT INTO public.memberships (tenant_id, principal_type, principal_id, identity_platform_uid, email, role)
       VALUES ($1, 'doula', $2, $3, $4, 'doula')`,
        [A, originalId, UID, EMAIL]
      );
    });

    afterAll(async () => {
      await getPool().end();
      await owner?.end();
      await cluster?.query(`DROP DATABASE ${database} WITH (FORCE)`);
      await cluster?.end();
    });

    const invite = async (tenantId = B, email = EMAIL) => {
      const pending = await createStaffInvitation({
        tenantId,
        email,
        firstname: 'Original Organization',
        lastname: 'Profile',
        role: 'doula',
        invitedByEmail: 'admin@example.test',
      });
      const sent =
        mockSendInvite.mock.calls[mockSendInvite.mock.calls.length - 1][0];
      return {
        ...pending,
        token: new URL(sent.acceptUrl).searchParams.get('token')!,
      };
    };
    const accept = (token: string) =>
      acceptStaffInvitation({ token, identityToken: 'verified-test-token' });
    const count = async (table: string) =>
      Number(
        (await owner.query(`SELECT count(*) FROM public.${table}`)).rows[0]
          .count
      );

    it('adds another org using the same login and preserves the original profile and membership', async () => {
      const pending = await invite();
      expect(await previewStaffInvitation(pending.token)).toMatchObject({
        requiresSignIn: true,
      });
      expect(await accept(pending.token)).toMatchObject({
        requiresEmailVerification: false,
      });
      const rows = (
        await owner.query('SELECT * FROM public.doulas ORDER BY tenant_id')
      ).rows;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        id: originalId,
        bio: 'Private org A bio',
        identity_platform_uid: UID,
      });
      expect(rows[1]).toMatchObject({
        tenant_id: B,
        identity_platform_uid: UID,
        bio: null,
      });
      expect(rows[1].id).not.toBe(originalId);
      expect(rows[1].full_name).toBe(rows[0].full_name);
      expect(await count('memberships')).toBe(2);
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockDeleteUser).not.toHaveBeenCalled();
      expect(mockSetClaims).not.toHaveBeenCalled();
      expect(mockSendVerification).not.toHaveBeenCalled();
    });

    it('rejects an existing member of this org without sending an invitation', async () => {
      await expect(invite(A, ' DOULA@EXAMPLE.TEST ')).rejects.toThrow(
        'already a member of your organization'
      );
      expect(mockSendInvite).not.toHaveBeenCalled();
    });

    it('requires existing-account authentication and rejects a different signed-in account', async () => {
      const pending = await invite();
      await expect(
        acceptStaffInvitation({
          token: pending.token,
          password: 'not-a-new-password',
        })
      ).rejects.toThrow('Sign in to your existing account');
      mockVerifyToken.mockResolvedValueOnce({
        uid: 'attacker',
        email: 'attacker@example.test',
      });
      await expect(accept(pending.token)).rejects.toThrow(
        'email address this invitation was sent to'
      );
      expect(await count('memberships')).toBe(1);
      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it('rejects invalid/revoked sessions and disabled identities', async () => {
      const pending = await invite();
      mockVerifyToken.mockRejectedValueOnce(
        new Error('Invalid or expired token')
      );
      await expect(accept(pending.token)).rejects.toThrow('Invalid or expired');
      mockIdentities.get(EMAIL).disabled = true;
      await expect(accept(pending.token)).rejects.toThrow('disabled');
      expect(await count('memberships')).toBe(1);
    });

    it('serializes simultaneous duplicate invitations', async () => {
      const attempts = await Promise.allSettled([invite(), invite()]);
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(await count('staff_invitations')).toBe(1);
      expect(mockSendInvite).toHaveBeenCalledTimes(1);
    });

    it('allows re-inviting after expiration, revoking the old link', async () => {
      const expired = await invite();
      await owner.query(
        "UPDATE public.staff_invitations SET expires_at = now() - interval '1 second'"
      );
      const replacement = await invite();
      await expect(accept(expired.token)).rejects.toThrow('expired');
      await accept(replacement.token);
      expect(await count('memberships')).toBe(2);
    });

    it('accepts a token only once even under concurrent requests', async () => {
      const pending = await invite();
      const attempts = await Promise.allSettled([
        accept(pending.token),
        accept(pending.token),
      ]);
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await count('memberships')).toBe(2);
      expect(await count('doulas')).toBe(2);
      expect(
        (
          await owner.query(
            "SELECT * FROM staff_invitation_events WHERE event = 'accepted'"
          )
        ).rowCount
      ).toBe(1);
      await expect(accept(pending.token)).rejects.toThrow('already accepted');
    });

    it('rolls back all writes on membership failure without deleting a shared identity', async () => {
      const pending = await invite();
      await owner.query(
        "ALTER TABLE memberships ADD CONSTRAINT simulated_failure CHECK (tenant_id <> '22222222-2222-4222-8222-222222222222')"
      );
      try {
        await expect(accept(pending.token)).rejects.toThrow(
          'simulated_failure'
        );
        expect(await count('doulas')).toBe(1);
        expect(await count('memberships')).toBe(1);
        expect(
          (
            await owner.query(
              'SELECT status FROM staff_invitations WHERE id = $1',
              [pending.id]
            )
          ).rows[0].status
        ).toBe('pending');
        expect(mockDeleteUser).not.toHaveBeenCalled();
      } finally {
        await owner.query(
          'ALTER TABLE memberships DROP CONSTRAINT simulated_failure'
        );
      }
    });

    it('still provisions a brand-new account and requires inbox verification', async () => {
      const pending = await invite(B, 'new@example.test');
      expect(await previewStaffInvitation(pending.token)).toMatchObject({
        requiresSignIn: false,
      });
      await expect(
        acceptStaffInvitation({ token: pending.token, password: 'short' })
      ).rejects.toThrow('8 characters');
      const result = await acceptStaffInvitation({
        token: pending.token,
        password: 'synthetic-password',
      });
      expect(result.requiresEmailVerification).toBe(true);
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
      expect(mockSendVerification).toHaveBeenCalledWith('new-login');
    });

    it('cleans up only a newly created identity if persistence fails', async () => {
      const pending = await invite(B, 'new@example.test');
      await owner.query(
        "ALTER TABLE memberships ADD CONSTRAINT simulated_failure CHECK (tenant_id <> '22222222-2222-4222-8222-222222222222')"
      );
      try {
        await expect(
          acceptStaffInvitation({
            token: pending.token,
            password: 'synthetic-password',
          })
        ).rejects.toThrow('simulated_failure');
        expect(mockDeleteUser).toHaveBeenCalledWith('new-login');
        expect(await count('doulas')).toBe(1);
      } finally {
        await owner.query(
          'ALTER TABLE memberships DROP CONSTRAINT simulated_failure'
        );
      }
    });

    it('requires tenant selection and resolves each org to its own profile under real RLS', async () => {
      const pending = await invite();
      await accept(pending.token);
      const principal = { userId: UID, email: EMAIL };
      expect(await resolveTenantGate(principal)).toMatchObject({
        action: 'deny',
        code: 'TENANT_SELECTION_REQUIRED',
      });
      const gateA = await resolveTenantGate({
        ...principal,
        requestedTenant: A,
      });
      const gateB = await resolveTenantGate({
        ...principal,
        requestedTenant: B,
      });
      if (gateA.action !== 'attach' || gateB.action !== 'attach')
        throw new Error('Expected memberships');
      const claims = { uid: UID, email: EMAIL };
      const userA = await profile.findTenantUser(claims, gateA.tenant);
      const userB = await profile.findTenantUser(claims, gateB.tenant);
      expect(userA).toMatchObject({ id: originalId, bio: 'Private org A bio' });
      expect(userB?.id).not.toBe(originalId);
      expect(userB?.bio).toBe('');
      expect(
        await profile.findTenantUser(claims, {
          ...gateB.tenant,
          membershipId: gateA.tenant.membershipId,
        })
      ).toBeNull();
      const hidden = await runWithTenant(B, () =>
        getPool().query('SELECT * FROM doulas WHERE id = $1', [originalId])
      );
      expect(hidden.rowCount).toBe(0);
      const gateC = await resolveTenantGate({
        ...principal,
        requestedTenant: '33333333-3333-4333-8333-333333333333',
      });
      expect(gateC.action).toBe('deny');
    });

    it('rejects inactive/unknown organizations and missing tenant context', async () => {
      await expect(invite(null)).rejects.toThrow('Sign in to an organization');
      await expect(accept('not-a-token')).rejects.toThrow('no longer valid');
      const pending = await invite();
      await owner.query(
        "UPDATE tenants SET status = 'inactive' WHERE id = $1",
        [B]
      );
      await expect(accept(pending.token)).rejects.toThrow('no longer valid');
    });

    it('resolves a billing membership backed by an admin principal without inheriting the admin role', async () => {
      const { rows } = await owner.query(
        `INSERT INTO admins (tenant_id, email, identity_platform_uid, full_name)
       VALUES ($1, 'billing@example.test', 'billing-login', 'Billing Staff') RETURNING id`,
        [B]
      );
      const membership = await owner.query(
        `INSERT INTO memberships (tenant_id, principal_type, principal_id, identity_platform_uid, email, role)
       VALUES ($1, 'admin', $2, 'billing-login', 'billing@example.test', 'billing') RETURNING id`,
        [B, rows[0].id]
      );
      const gate = await resolveTenantGate({
        userId: 'billing-login',
        email: 'billing@example.test',
        requestedTenant: B,
      });
      if (gate.action !== 'attach')
        throw new Error('Expected billing membership');
      expect(gate.tenant.membershipId).toBe(membership.rows[0].id);
      const user = await profile.findTenantUser(
        { uid: 'billing-login', email: 'billing@example.test' },
        gate.tenant
      );
      expect(user).toMatchObject({ id: rows[0].id, role: 'billing' });
    });

    it('does not add shared accounts while tenant isolation is disabled', async () => {
      const pending = await invite();
      process.env.TENANCY_ENFORCE = 'off';
      try {
        await expect(accept(pending.token)).rejects.toThrow(
          'Organization isolation must be enabled'
        );
        expect(await count('memberships')).toBe(1);
      } finally {
        process.env.TENANCY_ENFORCE = 'on';
      }
    });

    it('migration is repeatable and keeps within-org email and UID uniqueness', async () => {
      await owner.query(migration());
      await expect(
        owner.query('INSERT INTO doulas (tenant_id, email) VALUES ($1, $2)', [
          A,
          'DOULA@EXAMPLE.TEST',
        ])
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        owner.query(
          'INSERT INTO doulas (tenant_id, email, identity_platform_uid) VALUES ($1, $2, $3)',
          [A, 'different@example.test', UID]
        )
      ).rejects.toMatchObject({ code: '23505' });
      const pending = await invite();
      await accept(pending.token);
      expect(await count('doulas')).toBe(2);
    });
  }
);
