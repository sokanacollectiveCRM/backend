import { getPool } from '../db/cloudSqlPool';
import type { User } from '../entities/User';

const DENIED_ACCOUNT_STATUSES = new Set([
  'inactive',
  'disabled',
  'terminated',
  'suspended',
  'rejected',
  'archived',
  'deleted',
]);

/**
 * Account state is populated from the app-managed user/team record during each
 * token resolution. Never consult provider/user metadata for this decision.
 */
export function isAccountActive(user: User): boolean {
  const accountStatus = String(user.account_status ?? '')
    .trim()
    .toLowerCase();
  if (DENIED_ACCOUNT_STATUSES.has(accountStatus)) return false;

  if (String(user.role).toLowerCase() === 'client') {
    const portalStatus = String(
      (user as User & { portal_status?: string }).portal_status ?? ''
    )
      .trim()
      .toLowerCase();
    if (DENIED_ACCOUNT_STATUSES.has(portalStatus)) return false;
  }

  return true;
}

/** Refresh client portal state from Cloud SQL so a previously issued token is
 * denied immediately after portal disablement. Staff state is already loaded
 * from the app-managed user/team record by both token loaders on every request. */
export async function isCurrentAccountActive(user: User): Promise<boolean> {
  if (!isAccountActive(user)) return false;
  if (String(user.role).toLowerCase() !== 'client') return true;

  const { rows } = await getPool().query<{ portal_status: string | null }>(
    `SELECT portal_status
       FROM public.phi_clients
      WHERE user_id::text = $1::text OR id::text = $1::text
      LIMIT 1`,
    [String(user.id)]
  );
  const status = String(rows[0]?.portal_status ?? '')
    .trim()
    .toLowerCase();
  return !DENIED_ACCOUNT_STATUSES.has(status);
}
