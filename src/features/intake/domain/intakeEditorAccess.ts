import type { MembershipRole } from '../../tenancy/domain/types';

export type IntakeEditorDecision =
  | { ok: true; tenantId: string; platformSupport: boolean }
  | { ok: false; status: 400 | 403; error: string };

const BLOCKED_ROLES = new Set(['doula', 'billing', 'client']);

/**
 * Org admins edit the session tenant only. A platform support engineer may
 * pass tenantId. Doula, billing, and client are refused even if they pass
 * a tenant id. platformAdmin on the session tenant stays false.
 */
export function resolveIntakeEditorTenant(input: {
  sessionRole: string | null;
  platformSupport: boolean;
  sessionTenantId: string | null;
  requestedTenantId: string | null;
}): IntakeEditorDecision {
  const role = (input.sessionRole ?? '').toLowerCase();
  const requested = blankToNull(input.requestedTenantId);
  const sessionTenantId = blankToNull(input.sessionTenantId);

  if (!input.platformSupport && BLOCKED_ROLES.has(role)) {
    return {
      ok: false,
      status: 403,
      error: 'Only an organization admin can edit the intake form.',
    };
  }

  if (input.platformSupport) {
    if (!requested) {
      return {
        ok: false,
        status: 400,
        error: 'Choose an organization.',
      };
    }
    return { ok: true, tenantId: requested, platformSupport: true };
  }

  if (role === 'admin' && sessionTenantId) {
    if (requested && requested !== sessionTenantId) {
      return {
        ok: false,
        status: 403,
        error: 'You can edit the intake form for your organization only.',
      };
    }
    return { ok: true, tenantId: sessionTenantId, platformSupport: false };
  }

  return {
    ok: false,
    status: 403,
    error: 'Only an organization admin can edit the intake form.',
  };
}

export function isIntakeEditorRole(
  role: MembershipRole | string | null
): boolean {
  return (role ?? '').toLowerCase() === 'admin';
}

function blankToNull(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
