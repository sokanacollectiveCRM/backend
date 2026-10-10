/**
 * Public tenancy API.
 * Cross-feature consumers should import from this barrel only.
 */

export {
  SOKANA_TENANT_ID,
  SOKANA_TENANT_SLUG,
  SOKANA_TENANT_NAME,
  SYNTHETIC_TENANT_ID,
  SYNTHETIC_TENANT_SLUG,
  TENANT_HEADER,
} from './domain/constants';
export { gateTenantResolution } from './domain/gateTenantResolution';
export type { TenantGate } from './domain/gateTenantResolution';
export {
  resolveActiveMembership,
  selectMembershipCandidates,
} from './domain/resolveActiveMembership';
export type { MembershipResolution } from './domain/resolveActiveMembership';
export {
  isTenantRowVisible,
  isTenantWriteAllowed,
  resolveTenantSession,
} from './domain/tenantSession';
export type {
  TenancyEnforceMode,
  TenantSessionSettings,
} from './domain/tenantSession';
export type {
  MembershipRecord,
  MembershipRole,
  TenantChoice,
  TenantView,
} from './domain/types';
export { resolveTenantGate } from './application/resolveTenantGate';
export {
  readTenantRequestState,
  runWithTenant,
  runWithTenancyBypass,
  runWithTenantState,
} from './application/tenantRequestStore';
export { assertStaffInviteEmail } from './application/assertStaffInviteEmail';
export { isTenancyEnforced } from './infrastructure/tenancyMode';
export { isPlatformSupportPrincipal } from './infrastructure/platformAdminRepository';
