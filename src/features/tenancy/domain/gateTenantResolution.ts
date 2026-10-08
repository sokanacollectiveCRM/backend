import type { MembershipResolution } from './resolveActiveMembership';
import type { TenantChoice, TenantView } from './types';

export type TenantGate =
  | { action: 'attach'; tenant: TenantView }
  | { action: 'continue' }
  | {
      action: 'deny';
      status: 403 | 409;
      error: string;
      code: 'FORBIDDEN' | 'TENANT_SELECTION_REQUIRED';
      tenants?: TenantChoice[];
    };

export function toTenantView(
  membership: Extract<MembershipResolution, { status: 'ok' }>['membership']
): TenantView {
  return {
    id: membership.tenantId,
    slug: membership.slug,
    name: membership.name,
    role: membership.role,
    membershipId: membership.id,
    platformAdmin: false,
  };
}

/**
 * While enforcement is off, a resolved membership is attached for stamping
 * and a missing membership leaves the request unchanged.
 * While enforcement is on, every authenticated request needs one organization.
 */
export function gateTenantResolution(input: {
  enforce: boolean;
  resolution: MembershipResolution;
}): TenantGate {
  if (input.resolution.status === 'ok') {
    return {
      action: 'attach',
      tenant: toTenantView(input.resolution.membership),
    };
  }
  if (!input.enforce) return { action: 'continue' };

  if (input.resolution.status === 'selection_required') {
    return {
      action: 'deny',
      status: 409,
      error: 'Choose an organization',
      code: 'TENANT_SELECTION_REQUIRED',
      tenants: input.resolution.tenants,
    };
  }
  if (input.resolution.status === 'forbidden') {
    return {
      action: 'deny',
      status: 403,
      error: 'You do not belong to that organization',
      code: 'FORBIDDEN',
    };
  }
  if (input.resolution.status === 'inactive') {
    return {
      action: 'deny',
      status: 403,
      error: 'Organization membership is inactive',
      code: 'FORBIDDEN',
    };
  }
  return {
    action: 'deny',
    status: 403,
    error: 'No active organization membership',
    code: 'FORBIDDEN',
  };
}
