import type { PoolClient } from 'pg';

import { getPool } from '../../../db/cloudSqlPool';
import type { AuthRequest } from '../../../types';

class PermissionError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Only app-managed admin records count. Provider metadata and generic admin role
// never grant permission. Read on every request, including within mutations.
async function requireManager(db: Pick<PoolClient, 'query'>, req: AuthRequest) {
  if (req.user?.role !== 'admin' || !req.user.id || !req.tenant?.id)
    throw new PermissionError(403, 'Staff permissions access denied.');
  const result = await db.query(
    `SELECT a.id FROM public.admins a
    WHERE a.tenant_id=$1::uuid AND a.id::text=$2 AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=a.tenant_id AND m.principal_id=a.id AND m.status='inactive') AND (
      to_jsonb(a)->>'is_super_admin'='true' OR
      to_jsonb(a)->>'role' IN ('super_admin','superadmin') OR EXISTS (
        SELECT 1 FROM public.doula_hr_permissions p WHERE p.tenant_id=a.tenant_id
        AND p.admin_id=a.id::text AND p.department IN ('hr','payroll'))
    )`,
    [req.tenant.id, req.user.id]
  );
  if (!result.rowCount)
    throw new PermissionError(403, 'Staff permissions access denied.');
}

export async function staffPermissionsAccess(req: AuthRequest) {
  await requireManager(getPool(), req);
  return { allowed: true };
}

export async function readStaffPermissions(req: AuthRequest) {
  const db = getPool();
  await requireManager(db, req);
  const { rows: admins } = await db.query(
    `SELECT a.id, a.full_name AS name, a.email,
    EXISTS(SELECT 1 FROM public.doula_hr_permissions p WHERE p.tenant_id=a.tenant_id AND p.admin_id=a.id::text AND p.department='hr') AS hr,
    EXISTS(SELECT 1 FROM public.doula_hr_permissions p WHERE p.tenant_id=a.tenant_id AND p.admin_id=a.id::text AND p.department='payroll') AS payroll
    FROM public.admins a WHERE a.tenant_id=$1::uuid AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=a.tenant_id AND m.principal_id=a.id AND m.status='inactive') ORDER BY lower(a.email),a.id`,
    [req.tenant!.id]
  );
  const { rows } = await db.query(
    `SELECT e.*, actor.email AS actor_email, target.email AS admin_email
    FROM public.staff_permission_events e
    LEFT JOIN public.admins actor ON actor.id::text=e.actor_id AND actor.tenant_id=e.tenant_id
    LEFT JOIN public.admins target ON target.id::text=e.admin_id AND target.tenant_id=e.tenant_id
    WHERE e.tenant_id=$1::uuid ORDER BY e.changed_at DESC,e.id DESC LIMIT 1`,
    [req.tenant!.id]
  );
  return { admins, lastChange: rows[0] ?? null };
}

export async function changeStaffPermission(req: AuthRequest) {
  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    // Serialize all writers across processes, then recheck the actor after waiting.
    await db.query('LOCK TABLE public.doula_hr_permissions IN EXCLUSIVE MODE');
    await requireManager(db, req);
    const { capability, enabled } = req.body ?? {};
    if (
      !['hr', 'payroll'].includes(capability) ||
      typeof enabled !== 'boolean' ||
      Object.keys(req.body).some((k) => !['capability', 'enabled'].includes(k))
    )
      throw new PermissionError(
        400,
        'Choose HR or Payroll and a boolean enabled value.'
      );
    const tenantId = req.tenant!.id,
      adminId = req.params.adminId;
    const target = await db.query(
      `SELECT id FROM public.admins WHERE tenant_id=$1::uuid AND id::text=$2 AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=admins.tenant_id AND m.principal_id=admins.id AND m.status='inactive') FOR UPDATE`,
      [tenantId, adminId]
    );
    if (!target.rowCount) throw new PermissionError(404, 'Admin not found.');
    const current = await db.query(
      'SELECT 1 FROM public.doula_hr_permissions WHERE tenant_id=$1::uuid AND admin_id=$2 AND department=$3',
      [tenantId, adminId, capability]
    );
    const old = !!current.rowCount;
    if (old !== enabled) {
      if (!enabled) {
        const remaining = await db.query(
          `SELECT 1 FROM public.doula_hr_permissions p JOIN public.admins a ON a.tenant_id=p.tenant_id AND a.id::text=p.admin_id
          WHERE p.tenant_id=$1::uuid AND NOT (p.admin_id=$2 AND p.department=$3) AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=a.tenant_id AND m.principal_id=a.id AND m.status='inactive') LIMIT 1`,
          [tenantId, adminId, capability]
        );
        if (!remaining.rowCount)
          throw new PermissionError(
            409,
            'Cannot remove the last person with HR/payroll access. Grant access to another admin first.'
          );
        await db.query(
          'DELETE FROM public.doula_hr_permissions WHERE tenant_id=$1::uuid AND admin_id=$2 AND department=$3',
          [tenantId, adminId, capability]
        );
      } else {
        await db.query(
          'INSERT INTO public.doula_hr_permissions(tenant_id,admin_id,department) VALUES($1::uuid,$2,$3)',
          [tenantId, adminId, capability]
        );
      }
      await db.query(
        'INSERT INTO public.staff_permission_events(tenant_id,actor_id,admin_id,capability,old_value,new_value) VALUES($1::uuid,$2,$3,$4,$5,$6)',
        [tenantId, req.user!.id, adminId, capability, old, enabled]
      );
    }
    await db.query('COMMIT');
    return { changed: old !== enabled };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

export function staffPermissionHandler(
  action: (req: AuthRequest) => Promise<unknown>
) {
  return async (req: AuthRequest, res: import('express').Response) => {
    try {
      res.json(await action(req));
    } catch (error) {
      if (error instanceof PermissionError)
        res.status(error.status).json({ error: error.message });
      else
        res
          .status(500)
          .json({ error: 'Unable to update or read staff permissions.' });
    }
  };
}
