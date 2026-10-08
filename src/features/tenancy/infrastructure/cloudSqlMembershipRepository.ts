import { getPool } from '../../../db/cloudSqlPool';
import type { MembershipRecord, MembershipRole } from '../domain/types';

export interface MembershipPrincipalQuery {
  userId: string;
  email?: string | null;
}

type MembershipRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  tenant_status: string;
  principal_id: string;
  linked_user_id: string | null;
  identity_platform_uid: string | null;
  email: string | null;
  role: string;
  status: string;
};

const MEMBERSHIP_SQL = `
  SELECT
    m.id::text,
    m.tenant_id::text,
    t.slug,
    t.name,
    t.status AS tenant_status,
    m.principal_id::text,
    m.linked_user_id,
    m.identity_platform_uid,
    m.email,
    m.role,
    m.status
  FROM public.memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.principal_id::text = $1
     OR ($1::text IS NOT NULL AND m.linked_user_id = $1)
     OR ($1::text IS NOT NULL AND m.identity_platform_uid = $1)
     OR ($2::text IS NOT NULL AND lower(m.email) = $2)
`;

function isTenancySchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: string }).code || '');
  const message = String((error as { message?: string }).message || '');
  return (
    code === '42P01' ||
    code === '42703' ||
    message.includes('Missing required Cloud SQL env')
  );
}

function asRole(value: string): MembershipRole {
  if (
    value === 'admin' ||
    value === 'billing' ||
    value === 'doula' ||
    value === 'client'
  ) {
    return value;
  }
  return 'client';
}

function mapRow(row: MembershipRow): MembershipRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    tenantStatus: row.tenant_status === 'inactive' ? 'inactive' : 'active',
    principalId: row.principal_id,
    linkedUserId: row.linked_user_id,
    identityPlatformUid: row.identity_platform_uid,
    email: row.email,
    role: asRole(row.role),
    status: row.status === 'inactive' ? 'inactive' : 'active',
  };
}

export async function listMembershipCandidates(
  principal: MembershipPrincipalQuery
): Promise<MembershipRecord[] | 'unavailable'> {
  const email = principal.email?.trim().toLowerCase() || null;
  try {
    const { rows } = await getPool().query<MembershipRow>(MEMBERSHIP_SQL, [
      principal.userId,
      email,
    ]);
    return rows.map(mapRow);
  } catch (error) {
    if (isTenancySchemaMissing(error)) return 'unavailable';
    throw error;
  }
}
