export type TenancyEnforceMode = 'off' | 'on' | 'bypass';

export interface TenantSessionSettings {
  tenantId: string;
  enforce: TenancyEnforceMode;
}

/**
 * Session values written with set_config. Must stay aligned with the
 * `tenant_isolation` policy and `stamp_tenant_id` trigger.
 */
export function resolveTenantSession(input: {
  enforce: boolean;
  bypass: boolean;
  tenantId: string | null;
}): TenantSessionSettings {
  if (input.bypass) {
    return { tenantId: input.tenantId ?? '', enforce: 'bypass' };
  }
  if (!input.enforce) {
    return { tenantId: input.tenantId ?? '', enforce: 'off' };
  }
  return { tenantId: input.tenantId ?? '', enforce: 'on' };
}

/** Mirrors the SQL policy: isolation applies only when enforcement is on. */
export function isTenantRowVisible(input: {
  enforce: TenancyEnforceMode;
  sessionTenantId: string;
  rowTenantId: string | null;
}): boolean {
  if (input.enforce !== 'on') return true;
  return (
    input.rowTenantId !== null &&
    input.rowTenantId === input.sessionTenantId &&
    input.sessionTenantId !== ''
  );
}

/** Mirrors stamp_tenant_id: enforced writes must already belong to the session tenant. */
export function isTenantWriteAllowed(input: {
  enforce: TenancyEnforceMode;
  sessionTenantId: string;
  rowTenantId: string | null;
}): boolean {
  if (input.enforce !== 'on') return true;
  return (
    input.sessionTenantId !== '' && input.rowTenantId === input.sessionTenantId
  );
}
