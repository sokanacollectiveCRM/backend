/**
 * Sensitive Data Access Authorization Helper
 * 
 * HIPAA COMPLIANCE:
 * - Implements strict authorization gating for PHI access
 * - Uses fail-closed principle (deny on error)
 * - Does NOT log user IDs or client IDs in error cases
 * 
 * Authorization Rules (Appendix H):
 * - admin: Always authorized to view PHI
 * - doula: Authorized ONLY if assigned to the client
 * - All other roles: Denied
 */

import supabase from '../supabase';

/**
 * User object from auth middleware.
 * Contains id and role from staff cookie auth.
 */
interface AuthUser {
  id: string;
  role: 'admin' | 'doula' | string;
}

/**
 * Result of authorization check including assigned client IDs for broker.
 */
export interface SensitiveAccessResult {
  canAccess: boolean;
  assignedClientIds: string[];
}

/**
 * Check if a user is authorized to access sensitive/PHI data for a client.
 * Returns both the authorization result and the list of assigned client IDs
 * (needed for PHI Broker authorization).
 * 
 * Rules:
 * - admin => true (always)
 * - doula => true ONLY if assigned to the client
 * - other => false
 * 
 * IMPORTANT: Fails closed (returns false) on any error.
 * 
 * @param user - The authenticated user from req.user
 * @param clientId - The client ID to check access for
 * @returns SensitiveAccessResult with canAccess flag and assignedClientIds
 * 
 * HIPAA: Does not log user/client IDs in error cases
 */
export async function canAccessSensitive(
  user: AuthUser | undefined,
  clientId: string
): Promise<SensitiveAccessResult> {
  // No user = no access
  if (!user || !user.id || !user.role) {
    return { canAccess: false, assignedClientIds: [] };
  }

  // Admin always has access
  if (user.role === 'admin') {
    // Admin doesn't need assigned IDs - broker will grant access based on role
    return { canAccess: true, assignedClientIds: [] };
  }

  // Doula: check assignment and get all assigned client IDs
  if (user.role === 'doula') {
    const assignedClientIds = await getDoulaAssignedClientIds(user.id);
    const canAccess = assignedClientIds.includes(clientId);
    return { canAccess, assignedClientIds };
  }

  // All other roles: denied
  return { canAccess: false, assignedClientIds: [] };
}

/**
 * Get all client IDs assigned to a doula.
 * 
 * @param doulaId - The doula's user ID
 * @returns Array of assigned client IDs (empty on error - fail closed)
 */
async function getDoulaAssignedClientIds(doulaId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId)
      .eq('status', 'active');

    if (error) {
      // HIPAA: Do not log user IDs
      console.error('[SensitiveAccess] Assignment lookup failed');
      // Fail closed
      return [];
    }

    return data?.map(row => row.client_id) || [];
  } catch (error) {
    // HIPAA: Do not log error details
    console.error('[SensitiveAccess] Assignment check error');
    // Fail closed
    return [];
  }
}

/**
 * Type guard to check if a role can potentially access sensitive data.
 * Admin and doula roles may have access (subject to assignment check for doulas).
 * 
 * @param role - The user's role
 * @returns true if the role can potentially access sensitive data
 */
export function canRoleAccessSensitive(role: string | undefined): boolean {
  return role === 'admin' || role === 'doula';
}
