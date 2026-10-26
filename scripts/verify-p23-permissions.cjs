const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly: true });
async function main() {
  const db = new PGlite();
  const tenant = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const ids = [3, 4, 5, 6].map(
    (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  );
  const query = async (sql, args) => {
    const r = await db.query(sql, args);
    return { ...r, rowCount: r.rows.length || r.affectedRows || 0 };
  };
  const client = { query, release() {} };
  const poolPath = require.resolve('../src/db/cloudSqlPool.ts');
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: { getPool: () => ({ query, connect: async () => client }) },
  };
  const {
    changeStaffPermission,
    readStaffPermissions,
    staffPermissionsAccess,
    staffPermissionHandler,
  } = require('../src/features/admin/application/staffPermissions.ts');
  const {
    canManageHrDocuments,
  } = require('../src/features/doulas/application/backgroundCheck.ts');
  const req = (id, role = 'admin', tenantId = tenant) => ({
    user: { id, role },
    tenant: { id: tenantId },
    params: { adminId: ids[1] },
    body: { capability: 'hr', enabled: true },
  });
  const change = (actor, target, capability, enabled) =>
    changeStaffPermission({
      ...req(actor),
      params: { adminId: target },
      body: { capability, enabled },
    });
  try {
    await db.exec(`CREATE TABLE admins(id uuid PRIMARY KEY, tenant_id uuid, full_name text, email text, is_super_admin boolean DEFAULT false);
      CREATE TABLE doula_hr_permissions(tenant_id uuid,admin_id text,department text CHECK(department IN ('hr','payroll')),PRIMARY KEY(tenant_id,admin_id));`);
    for (let i = 0; i < ids.length; i++)
      await query('INSERT INTO admins VALUES($1,$2,$3,$4,$5)', [
        ids[i],
        i === 3 ? other : tenant,
        `Fictional ${i}`,
        `fixture${i}@example.test`,
        i === 0,
      ]);
    await query("INSERT INTO doula_hr_permissions VALUES($1,$2,'payroll')", [
      tenant,
      ids[0],
    ]);
    const migration = readFileSync(
      path.join(
        __dirname,
        '../src/db/migrations/20261026_p23_staff_permissions.sql'
      ),
      'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(
      "CREATE TABLE memberships(tenant_id uuid,principal_id uuid,status text,role text CHECK(role IN ('admin','billing','doula','client')))"
    );
    await db.exec("INSERT INTO memberships(role) VALUES('admin')");
    const hrMigration = readFileSync(
      path.join(__dirname, '../src/db/migrations/20261026_p23_hr_role.sql'),
      'utf8'
    );
    await db.exec(hrMigration);
    await db.exec(hrMigration);
    assert.equal(
      (await query('SELECT staff_role FROM admins LIMIT 1')).rows[0].staff_role,
      'admin'
    );
    assert.equal(
      (await query('SELECT role FROM memberships')).rows[0].role,
      'admin'
    );
    await db.exec("INSERT INTO memberships(role) VALUES('hr')");
    assert.equal(await canManageHrDocuments(req(ids[0])), true);
    for (const denied of [
      req(ids[1]),
      req(ids[0], 'client'),
      req(ids[0], 'doula'),
      req(ids[0], 'billing'),
      req(ids[0], 'admin', other),
      { user: { id: ids[0], role: 'admin' } },
    ]) {
      await assert.rejects(
        () => readStaffPermissions(denied),
        (e) => e.status === 403
      );
      await assert.rejects(
        () => changeStaffPermission(denied),
        (e) => e.status === 403
      );
    }
    let status;
    await staffPermissionHandler(readStaffPermissions)(req(ids[1]), {
      status(s) {
        status = s;
        return this;
      },
      json() {},
    });
    assert.equal(status, 403);
    // Super admin can bootstrap without a capability; generic admin cannot.
    await query('DELETE FROM doula_hr_permissions');
    await staffPermissionsAccess(req(ids[0]));
    await change(ids[0], ids[0], 'payroll', true);
    await assert.rejects(
      () => change(ids[0], ids[0], 'payroll', false),
      (e) => e.status === 409
    );
    assert.equal(await canManageHrDocuments(req(ids[1])), false);
    await change(ids[0], ids[1], 'hr', true);
    assert.equal(await canManageHrDocuments(req(ids[1])), true);
    await staffPermissionsAccess(req(ids[1]));
    await change(ids[1], ids[2], 'payroll', true); // HR manager may grant Payroll.
    await change(ids[2], ids[1], 'payroll', true); // Payroll manager may grant.
    assert.equal(
      (await readStaffPermissions(req(ids[1]))).admins.find(
        (a) => a.id === ids[1]
      ).payroll,
      true
    );
    const countBefore = (await query('SELECT * FROM staff_permission_events'))
      .rowCount;
    await change(ids[0], ids[1], 'hr', true);
    assert.equal(
      (await query('SELECT * FROM staff_permission_events')).rowCount,
      countBefore
    );
    await assert.rejects(
      () => change(ids[0], ids[3], 'hr', true),
      (e) => e.status === 404
    );
    await assert.rejects(
      () => change(ids[0], ids[1], 'owner', true),
      (e) => e.status === 400
    );
    await assert.rejects(
      () => change(ids[0], ids[1], 'hr', 'true'),
      (e) => e.status === 400
    );
    await change(ids[0], ids[1], 'hr', false);
    assert.equal(await canManageHrDocuments(req(ids[1])), true); // Payroll still grants access.
    await change(ids[0], ids[1], 'payroll', false);
    assert.equal(await canManageHrDocuments(req(ids[1])), false);
    await assert.rejects(
      () => staffPermissionsAccess(req(ids[1])),
      (e) => e.status === 403
    );
    const last = (await readStaffPermissions(req(ids[0]))).lastChange;
    assert.equal(last.actor_id, ids[0]);
    assert.equal(last.admin_id, ids[1]);
    assert.equal(last.capability, 'payroll');
    assert.equal(last.old_value, true);
    assert.equal(last.new_value, false);
    assert.ok(last.changed_at);
    // Audit failure rolls back the grant too.
    await db.exec(
      "ALTER TABLE staff_permission_events ADD CONSTRAINT reject_test CHECK(capability <> 'hr') NOT VALID"
    );
    await assert.rejects(() => change(ids[0], ids[1], 'hr', true));
    assert.equal(await canManageHrDocuments(req(ids[1])), false);
    console.log(
      'P-23 real SQL permission, migration, audit, rollback, tenant and next-request checks passed.'
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
