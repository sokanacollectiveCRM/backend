import type { MembershipRecord, MembershipRole, TenantChoice } from './types';

const ROLE_RANK: Record<MembershipRole, number> = {
  admin: 0,
  billing: 1,
  doula: 2,
  client: 3,
};

export type MembershipResolution =
  | { status: 'ok'; membership: MembershipRecord }
  | { status: 'none' }
  | { status: 'inactive' }
  | { status: 'forbidden' }
  | { status: 'selection_required'; tenants: TenantChoice[] };

export interface MembershipPrincipal {
  userId: string;
  email?: string | null;
}

/**
 * Prefer a direct id link over email so a shared inbox cannot inherit
 * another principal's role.
 */
export function selectMembershipCandidates(
  rows: MembershipRecord[],
  principal: MembershipPrincipal
): MembershipRecord[] {
  const userId = principal.userId.trim();
  const email = principal.email?.trim().toLowerCase() || null;

  const byUid = rows.filter(
    (row) =>
      row.identityPlatformUid !== null && row.identityPlatformUid === userId
  );
  if (byUid.length > 0) return byUid;

  const byId = rows.filter(
    (row) =>
      row.principalId === userId ||
      (row.linkedUserId !== null && row.linkedUserId === userId)
  );
  if (byId.length > 0) return byId;

  if (!email) return [];
  return rows.filter(
    (row) => row.email !== null && row.email.toLowerCase() === email
  );
}

function pickRole(
  rows: MembershipRecord[],
  currentRole: string | null
): MembershipRecord {
  const wanted = currentRole?.trim().toLowerCase() || null;
  const roleMatch = wanted ? rows.filter((row) => row.role === wanted) : [];
  const pool = roleMatch.length > 0 ? roleMatch : rows;
  return [...pool].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])[0];
}

export function resolveActiveMembership(input: {
  candidates: MembershipRecord[];
  requestedTenant?: string | null;
  currentRole?: string | null;
}): MembershipResolution {
  if (input.candidates.length === 0) return { status: 'none' };

  const inActiveTenants = input.candidates.filter(
    (row) => row.tenantStatus === 'active'
  );
  if (inActiveTenants.length === 0) return { status: 'inactive' };

  const requested = input.requestedTenant?.trim().toLowerCase() || null;
  let scoped = inActiveTenants;
  if (requested) {
    scoped = inActiveTenants.filter(
      (row) =>
        row.tenantId.toLowerCase() === requested ||
        row.slug.toLowerCase() === requested
    );
    if (scoped.length === 0) return { status: 'forbidden' };
  }

  const active = scoped.filter((row) => row.status === 'active');
  if (active.length === 0) return { status: 'inactive' };

  if (!requested) {
    const tenantIds = [...new Set(active.map((row) => row.tenantId))];
    if (tenantIds.length > 1) {
      return {
        status: 'selection_required',
        tenants: tenantIds.map((id) => {
          const row = active.find((item) => item.tenantId === id)!;
          return { id: row.tenantId, slug: row.slug, name: row.name };
        }),
      };
    }
  }

  return {
    status: 'ok',
    membership: pickRole(active, input.currentRole ?? null),
  };
}
