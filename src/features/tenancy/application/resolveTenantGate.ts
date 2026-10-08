import {
  type TenantGate,
  gateTenantResolution,
} from '../domain/gateTenantResolution';
import {
  resolveActiveMembership,
  selectMembershipCandidates,
} from '../domain/resolveActiveMembership';
import {
  type MembershipPrincipalQuery,
  listMembershipCandidates,
} from '../infrastructure/cloudSqlMembershipRepository';
import { isTenancyEnforced } from '../infrastructure/tenancyMode';

export async function resolveTenantGate(
  principal: MembershipPrincipalQuery & {
    requestedTenant?: string | null;
    currentRole?: string | null;
  }
): Promise<TenantGate | { action: 'unavailable' }> {
  const rows = await listMembershipCandidates(principal);
  if (rows === 'unavailable') return { action: 'unavailable' };

  const resolution = resolveActiveMembership({
    candidates: selectMembershipCandidates(rows, principal),
    requestedTenant: principal.requestedTenant,
    currentRole: principal.currentRole,
  });
  return gateTenantResolution({
    enforce: isTenancyEnforced(),
    resolution,
  });
}
