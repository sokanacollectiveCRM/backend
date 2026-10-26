const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs'),
  path = require('path'),
  assert = require('node:assert/strict'),
  { createHash } = require('crypto');
require('ts-node').register({ transpileOnly: true });
process.env.TENANCY_ENFORCE = 'on';
async function main() {
  const db = new PGlite();
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const [a, b, c, d] = [1, 2, 3, 4].map(uuid),
    [pa, pb] = [11, 12].map(uuid),
    email = 'doula@example.test',
    uid = 'shared-firebase-uid';
  const calls = { deleted: 0, createAttempts: 0, mail: 0 };
  let sentToken;
  const query = async (sql, args) => {
    const r = await db.query(sql, args);
    return { ...r, rowCount: r.rows.length || r.affectedRows || 0 };
  };
  const mock = (file, exports) => {
    const key = require.resolve(file);
    require.cache[key] = { id: key, filename: key, loaded: true, exports };
  };
  mock('../src/db/cloudSqlPool.ts', {
    getPool: () => ({ query, connect: async () => ({ query, release() {} }) }),
    queryCloudSql: query,
  });
  mock('../src/services/identityPlatform/firebaseAdmin.ts', {
    getFirebaseAuth: () => ({
      getUserByEmail: async () => ({ uid, email }),
      verifyIdToken: async (token) => ({
        uid: token === 'wrong' ? 'wrong-uid' : uid,
        email,
      }),
      deleteUser: async () => {
        calls.deleted++;
      },
      createUser: async () => {
        calls.createAttempts++;
        throw { code: 'auth/email-already-exists' };
      },
    }),
  });
  mock('../src/services/emailService.ts', {
    NodemailerService: class {
      async sendStaffInvitationEmail(input) {
        calls.mail++;
        sentToken = new URL(input.acceptUrl).searchParams.get('token');
      }
    },
  });
  const { User } = require('../src/entities/User.ts');
  mock('../src/index.ts', {
    identityTokenService: {
      resolveSessionUser: async () => ({
        user: new User({ id: pa, email, role: 'doula' }),
        firebaseUid: uid,
        emailVerified: true,
      }),
    },
  });
  const {
    CloudSqlTeamService,
  } = require('../src/services/cloudSqlTeamService.ts');
  const {
    acceptStaffInvitation,
    createStaffInvitation,
  } = require('../src/features/team/application/staffInvitationService.ts');
  const {
    resolveTenantGate,
  } = require('../src/features/tenancy/application/resolveTenantGate.ts');
  const {
    CloudSqlIdentityUserService,
  } = require('../src/services/identityPlatform/cloudSqlIdentityUserService.ts');
  const authMiddleware = require('../src/middleware/authMiddleware.ts').default;
  try {
    await db.exec(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text,status text DEFAULT 'active');
 CREATE TABLE admins(id uuid PRIMARY KEY,tenant_id uuid,full_name text,first_name text,last_name text,email text UNIQUE,identity_platform_uid text,staff_role text DEFAULT 'admin',phone text,address text,city text,state text,country text,zip_code text,bio text,profile_picture text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE doulas(id uuid PRIMARY KEY,tenant_id uuid,full_name text,email text UNIQUE,identity_platform_uid text,account_status text DEFAULT 'active',phone text,address text,city text,state text,country text,zip_code text,bio text,profile_picture text,profile_review_status text DEFAULT 'draft',profile_review_reason text,profile_review_version int DEFAULT 1,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE phi_clients(id uuid,user_id text,tenant_id uuid,email text,identity_platform_uid text,first_name text,last_name text,portal_status text,phone text,address_line1 text,city text,state text,country text,zip_code text,bio text);
 CREATE TABLE memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,principal_type text,principal_id uuid,identity_platform_uid text,linked_user_id text,email text,role text,status text,updated_at timestamptz DEFAULT now(),UNIQUE(tenant_id,principal_type,principal_id));
 CREATE TABLE doula_hr_permissions(tenant_id uuid,admin_id text,department text,PRIMARY KEY(tenant_id,admin_id,department));
 CREATE TABLE staff_permission_events(tenant_id uuid,actor_id text,admin_id text,capability text,old_value boolean,new_value boolean);
 CREATE TABLE doula_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,doula_id uuid,document_type text,file_path text);`);
    for (const [i, t] of [a, b, c, d].entries())
      await query('INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)', [
        t,
        `org-${i}`,
        `Organization ${i}`,
      ]);
    await query(
      "INSERT INTO doulas(id,tenant_id,full_name,email,identity_platform_uid,bio,profile_review_status) VALUES($1,$2,'Org A profile',$3,$4,'A-owned bio','approved')",
      [pa, a, email, uid]
    );
    await query(
      "INSERT INTO memberships(tenant_id,principal_type,principal_id,identity_platform_uid,email,role,status) VALUES($1,'doula',$2,$3,$4,'doula','active')",
      [a, pa, uid, email]
    );
    await query(
      "INSERT INTO doula_documents(tenant_id,doula_id,document_type,file_path) VALUES($1,$2,'w9','org-a/private.pdf')",
      [a, pa]
    );
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        '../src/db/migrations/20261026_organization_membership_lifecycle.sql'
      ),
      'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    await query(
      "INSERT INTO doulas(id,tenant_id,full_name,email,identity_platform_uid,bio) VALUES($1,$2,'Org B profile',$3,$4,'B-owned bio')",
      [pb, b, email, uid]
    );
    await query(
      "INSERT INTO memberships(tenant_id,principal_type,principal_id,identity_platform_uid,email,role,status) VALUES($1,'doula',$2,$3,$4,'doula','active')",
      [b, pb, uid, email]
    );
    await query(
      "INSERT INTO doula_documents(tenant_id,doula_id,document_type,file_path) VALUES($1,$2,'w9','org-b/private.pdf')",
      [b, pb]
    );
    const docs = async () =>
      JSON.stringify(
        (await query('SELECT * FROM doula_documents ORDER BY tenant_id')).rows
      );
    const original = await docs();
    assert.equal(
      (await resolveTenantGate({ userId: uid, email })).code,
      'TENANT_SELECTION_REQUIRED'
    );
    await new CloudSqlTeamService().deleteTeamMember(pa, a, 'org-a-admin');
    assert.equal(
      (await query('SELECT status FROM memberships WHERE tenant_id=$1', [a]))
        .rows[0].status,
      'inactive'
    );
    assert.equal(
      (await query('SELECT status FROM memberships WHERE tenant_id=$1', [b]))
        .rows[0].status,
      'active'
    );
    assert.equal(
      (await query('SELECT count(*)::int AS n FROM doulas')).rows[0].n,
      2
    );
    assert.equal(await docs(), original);
    assert.equal(calls.deleted, 0);
    assert.equal(
      (await resolveTenantGate({ userId: uid, email, requestedTenant: a }))
        .action,
      'deny'
    );
    assert.equal(
      (await resolveTenantGate({ userId: uid, email, requestedTenant: b }))
        .tenant.principalId,
      pb
    );
    const profile = await new CloudSqlIdentityUserService().findTenantUser(
      b,
      pb
    );
    assert.equal(profile.id, pb);
    assert.equal(profile.bio, 'B-owned bio');
    assert.equal(
      await new CloudSqlIdentityUserService().findTenantUser(b, pa),
      null
    );
    const {
      DoulaController,
    } = require('../src/controllers/doulaController.ts');
    let signed = false,
      docStatus;
    const controller = new DoulaController(
      {
        getDocumentById: async () => {
          throw Error('Cross-organization document must not be looked up');
        },
        getSignedUrl: async () => {
          signed = true;
        },
      },
      {},
      {},
      {},
      {},
      {},
      {}
    );
    await controller.getDocumentUrl(
      {
        params: { doulaId: pa, documentId: uuid(99) },
        tenant: { id: b },
        user: profile,
      },
      {
        status(code) {
          docStatus = code;
          return this;
        },
        json() {},
      }
    );
    assert.equal(docStatus, 404);
    assert.equal(signed, false);
    const request = {
      headers: { authorization: 'Bearer fixture' },
      query: {},
      method: 'GET',
      originalUrl: '/api/doulas/profile',
      path: '/profile',
      header: () => b,
    };
    let status,
      next = false;
    const response = {
      status(s) {
        status = s;
        return this;
      },
      json() {},
    };
    await authMiddleware(request, response, () => {
      next = true;
    });
    assert.equal(next, true);
    assert.equal(request.user.id, pb);
    next = false;
    request.header = () => a;
    await authMiddleware(request, response, () => {
      next = true;
    });
    assert.equal(next, false);
    assert.equal(status, 403);
    async function invite(tenant, token) {
      await query(
        "INSERT INTO staff_invitations(tenant_id,email,first_name,last_name,role,token_hash,expires_at,invited_by_email) VALUES($1,$2,'Invited','Doula','doula',$3,now()+interval '1 day','admin@example.test')",
        [tenant, email, createHash('sha256').update(token).digest('hex')]
      );
    }
    const {
      runWithTenant,
    } = require('../src/features/tenancy/application/tenantRequestStore.ts');
    const pending = await runWithTenant(a, () =>
      new CloudSqlTeamService().addTeamMember({
        firstname: 'Returning',
        lastname: 'Doula',
        email,
        role: 'doula',
        invitedById: 'org-a-admin',
        invitedByEmail: 'admin@example.test',
      })
    );
    assert.equal(pending.invitation_status, 'pending');
    assert.ok(sentToken);
    assert.equal(
      (await resolveTenantGate({ userId: uid, email, requestedTenant: a }))
        .action,
      'deny'
    );
    await acceptStaffInvitation({
      token: sentToken,
      password: '',
      idToken: 'valid',
    });
    assert.equal(
      (await query('SELECT status FROM memberships WHERE tenant_id=$1', [a]))
        .rows[0].status,
      'active'
    );
    assert.equal(
      (
        await query('SELECT profile_review_status FROM doulas WHERE id=$1', [
          pa,
        ])
      ).rows[0].profile_review_status,
      'draft'
    );
    assert.equal(await docs(), original);
    await assert.rejects(() =>
      acceptStaffInvitation({
        token: sentToken,
        password: '',
        idToken: 'valid',
      })
    );
    await invite(c, 'join-c');
    await assert.rejects(() =>
      acceptStaffInvitation({ token: 'join-c', password: '', idToken: 'wrong' })
    );
    assert.equal(
      (
        await query(
          'SELECT count(*)::int AS n FROM doulas WHERE tenant_id=$1',
          [c]
        )
      ).rows[0].n,
      0
    );
    await acceptStaffInvitation({
      token: 'join-c',
      password: '',
      idToken: 'valid',
    });
    const pc = (
      await query('SELECT id,bio FROM doulas WHERE tenant_id=$1', [c])
    ).rows[0];
    assert.notEqual(pc.id, pa);
    assert.notEqual(pc.id, pb);
    assert.equal(pc.bio, null);
    assert.equal(
      (
        await query(
          'SELECT count(*)::int AS n FROM doula_documents WHERE tenant_id=$1',
          [c]
        )
      ).rows[0].n,
      0
    );
    assert.equal(await docs(), original);
    await invite(d, 'join-d');
    await db.exec(
      "ALTER TABLE staff_membership_events ADD CONSTRAINT reject_join CHECK(event<>'joined') NOT VALID"
    );
    await assert.rejects(() =>
      acceptStaffInvitation({ token: 'join-d', password: '', idToken: 'valid' })
    );
    assert.equal(
      (
        await query(
          'SELECT count(*)::int AS n FROM doulas WHERE tenant_id=$1',
          [d]
        )
      ).rows[0].n,
      0
    );
    assert.equal(
      (
        await query(
          'SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1',
          [d]
        )
      ).rows[0].n,
      0
    );
    assert.equal(
      (
        await query('SELECT status FROM staff_invitations WHERE tenant_id=$1', [
          d,
        ])
      ).rows[0].status,
      'pending'
    );
    assert.deepEqual(calls, { createAttempts: 1, deleted: 0, mail: 1 });
    assert.equal(
      (
        await query(
          'SELECT event FROM staff_membership_events WHERE tenant_id=$1 ORDER BY occurred_at',
          [a]
        )
      ).rows
        .map((r) => r.event)
        .join(','),
      'removed,reinstated'
    );
    console.log(
      'Real SQL: removal, retained documents, other-org access, selected profile, reinstatement, empty new organization, identity verification, replay and audit rollback passed.'
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
