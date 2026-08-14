/**
 * Small, testable authorization policy helpers for PR 4.
 * Prefer these over ad-hoc role string checks when the same rule repeats.
 * Does not replace authMiddleware / authorizeRoles — it complements them.
 */

export type Actor = {
  id?: string;
  role?: string;
  email?: string;
};

export type AccessDecision = 'allow' | 'deny';

export const STAFF_ROLES = ['admin', 'billing', 'doula'] as const;
export const ADMIN_ONLY = ['admin'] as const;
export const ADMIN_BILLING = ['admin', 'billing'] as const;
export const ADMIN_DOULA = ['admin', 'doula'] as const;
export const ADMIN_DOULA_CLIENT = ['admin', 'doula', 'client'] as const;
export const ADMIN_BILLING_DOULA = ['admin', 'billing', 'doula'] as const;

export function normalizeRole(role: unknown): string {
  return String(role || '').toLowerCase();
}

/** Role allowlist check (mirrors authorizeRoles semantics). */
export function roleAllows(
  actor: Actor | null | undefined,
  allowedRoles: readonly string[]
): boolean {
  if (!actor?.email && !actor?.id) return false;
  const role = normalizeRole(actor.role);
  const allowed = allowedRoles.map((r) => r.toLowerCase());
  return Boolean(role) && allowed.includes(role);
}

/**
 * Ownership-or-staff rule for client/doula-scoped resources.
 * Staff roles always allow; otherwise the actor must own the resource id.
 */
export function decideOwnershipAccess(input: {
  actor: Actor | null | undefined;
  resourceOwnerId: string | null | undefined;
  staffRoles?: readonly string[];
}): AccessDecision {
  const { actor, resourceOwnerId } = input;
  const staffRoles = input.staffRoles ?? ADMIN_ONLY;
  if (!actor?.id) return 'deny';
  if (roleAllows(actor, staffRoles)) return 'allow';
  if (resourceOwnerId && actor.id === resourceOwnerId) return 'allow';
  return 'deny';
}

/**
 * Client-facing ownership: authenticated client may only access their own clientId.
 * Admin/billing/doula staff bypass ownership (assignment-level PHI checks remain elsewhere).
 */
export function decideClientResourceAccess(input: {
  actor: Actor | null | undefined;
  requestedClientId: string | null | undefined;
  actorClientId: string | null | undefined;
}): AccessDecision {
  const role = normalizeRole(input.actor?.role);
  if (!input.actor?.id) return 'deny';
  if (role === 'admin' || role === 'billing' || role === 'doula')
    return 'allow';
  if (role !== 'client') return 'deny';
  if (!input.requestedClientId || !input.actorClientId) return 'deny';
  return input.requestedClientId === input.actorClientId ? 'allow' : 'deny';
}

/** Safe denial body — does not reveal whether a resource exists. */
export function forbiddenBody(): { error: string; code: string } {
  return { error: 'Forbidden: Insufficient permissions', code: 'FORBIDDEN' };
}

export function unauthorizedBody(): {
  error: string;
  code: string;
  hint?: string;
} {
  return {
    error: 'No session token provided',
    code: 'UNAUTHENTICATED',
    hint: 'Provide Cookie or X-Session-Token header',
  };
}
