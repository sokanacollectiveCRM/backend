/**
 * Authoritative role resolution (PR 6).
 * Staff roles come only from Cloud SQL team tables and/or app-managed
 * `public.users.role` — never from client-writable `user_metadata` / `app_metadata`.
 */

import { getPool } from '../db/cloudSqlPool';
import { ROLE } from '../types';
import { normalizeRole } from './authorizationPolicies';

export type AppRole = 'admin' | 'doula' | 'billing' | 'client';

export type CloudSqlRoleHint = 'admin' | 'doula' | 'client' | null;

export interface AuthoritativeRoleLookup {
  findCloudSqlRole(authUserId: string, email: string | null): Promise<CloudSqlRoleHint>;
}

const STAFF_ROLES = new Set<AppRole>(['admin', 'doula', 'billing']);

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.has(normalizeRole(role) as AppRole);
}

export function normalizeAppManagedRole(role: unknown): AppRole | null {
  const normalized = normalizeRole(role);
  if (normalized === 'admin' || normalized === 'doula' || normalized === 'billing' || normalized === 'client') {
    return normalized;
  }
  return null;
}

export class DbAuthoritativeRoleLookup implements AuthoritativeRoleLookup {
  async findCloudSqlRole(authUserId: string, email: string | null): Promise<CloudSqlRoleHint> {
    const pool = getPool();
    const normalizedEmail = email?.trim().toLowerCase() || null;

    const admin = await pool.query(
      `SELECT 1
       FROM public.admins
       WHERE id = $1::uuid
          OR ($2::text IS NOT NULL AND lower(email) = $2::text)
       LIMIT 1`,
      [authUserId, normalizedEmail],
    );
    if (admin.rowCount && admin.rowCount > 0) return 'admin';

    const doula = await pool.query(
      `SELECT 1
       FROM public.doulas
       WHERE id = $1::uuid
          OR ($2::text IS NOT NULL AND lower(email) = $2::text)
       LIMIT 1`,
      [authUserId, normalizedEmail],
    );
    if (doula.rowCount && doula.rowCount > 0) return 'doula';

    const client = await pool.query(
      `SELECT 1
       FROM public.phi_clients
       WHERE user_id = $1::uuid
       LIMIT 1`,
      [authUserId],
    );
    if (client.rowCount && client.rowCount > 0) return 'client';

    return null;
  }
}

export class MemoryAuthoritativeRoleLookup implements AuthoritativeRoleLookup {
  constructor(
    private readonly rows: {
      admins?: Array<{ id: string; email?: string }>;
      doulas?: Array<{ id: string; email?: string }>;
      clients?: Array<{ userId: string }>;
    } = {},
  ) {}

  async findCloudSqlRole(authUserId: string, email: string | null): Promise<CloudSqlRoleHint> {
    const normalizedEmail = email?.trim().toLowerCase() || null;
    if (
      (this.rows.admins || []).some(
        (row) => row.id === authUserId || (normalizedEmail && row.email?.toLowerCase() === normalizedEmail),
      )
    ) {
      return 'admin';
    }
    if (
      (this.rows.doulas || []).some(
        (row) => row.id === authUserId || (normalizedEmail && row.email?.toLowerCase() === normalizedEmail),
      )
    ) {
      return 'doula';
    }
    if ((this.rows.clients || []).some((row) => row.userId === authUserId)) {
      return 'client';
    }
    return null;
  }
}

const useMemory =
  process.env.AUTH_ROLE_LOOKUP === 'memory' ||
  (process.env.NODE_ENV === 'test' && process.env.AUTH_ROLE_LOOKUP !== 'db');

let lookup: AuthoritativeRoleLookup = useMemory
  ? new MemoryAuthoritativeRoleLookup()
  : new DbAuthoritativeRoleLookup();

export function getAuthoritativeRoleLookup(): AuthoritativeRoleLookup {
  return lookup;
}

export function setAuthoritativeRoleLookupForTests(next: AuthoritativeRoleLookup): void {
  lookup = next;
}

export function resetAuthoritativeRoleLookupForTests(): void {
  lookup = useMemory
    ? new MemoryAuthoritativeRoleLookup()
    : new DbAuthoritativeRoleLookup();
}

/**
 * Resolve the role used for authorization.
 * - Cloud SQL admin/doula rows win.
 * - App-managed `public.users.role` is trusted (not metadata).
 * - Metadata is intentionally ignored.
 * - Unmatched authenticated users default to client (portal-safe).
 */
export async function resolveAuthoritativeRole(input: {
  authUserId: string;
  email?: string | null;
  /** Role from app-managed store only (e.g. Supabase public.users.role). */
  appManagedRole?: string | null;
}): Promise<AppRole> {
  const cloud = await getAuthoritativeRoleLookup().findCloudSqlRole(
    input.authUserId,
    input.email ?? null,
  );

  if (cloud === 'admin') return 'admin';
  if (cloud === 'doula') return 'doula';

  const appManaged = normalizeAppManagedRole(input.appManagedRole);
  if (appManaged) return appManaged;

  if (cloud === 'client') return 'client';
  return 'client';
}

export function toRoleEnum(role: AppRole): ROLE {
  switch (role) {
    case 'admin':
      return ROLE.ADMIN;
    case 'doula':
      return ROLE.DOULA;
    case 'billing':
      return ROLE.BILLING;
    default:
      return ROLE.CLIENT;
  }
}
