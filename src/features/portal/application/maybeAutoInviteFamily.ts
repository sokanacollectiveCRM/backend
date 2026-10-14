import { logger } from '../../../common/utils/logger';
import { getPool } from '../../../db/cloudSqlPool';
import { PortalInviteService } from '../../../services/portalInviteService';
import { readTenantRequestState, runWithTenant } from '../../tenancy';
import type { PortalEligibilitySnapshot } from '../domain/eligibility';

export function familyAutoInviteEnabled(env = process.env): boolean {
  if (env.FAMILY_AUTO_INVITE_ENABLED !== undefined)
    return env.FAMILY_AUTO_INVITE_ENABLED === 'true';
  return (
    env.K_SERVICE === 'sokana-private-api-dev' &&
    env.CLOUD_SQL_DATABASE === 'sokana_private_dev'
  );
}

/** Atomic durable claim prevents duplicate sends across workers and webhook retries.
 * Ambiguous send failures stay claimed: an admin can inspect and resend manually.
 * No sensitive content or email address is stored in this delivery ledger.
 */
export async function maybeAutoInviteFamily(
  clientId: string,
  snapshot: PortalEligibilitySnapshot
): Promise<void> {
  if (
    !familyAutoInviteEnabled() ||
    !snapshot?.is_eligible ||
    !snapshot.contract_signed ||
    !snapshot.deposit_paid
  )
    return;
  try {
    const tenantId = readTenantRequestState().tenantId;
    const { rows } = await getPool().query<{ tenant_id: string }>(
      `
      INSERT INTO public.family_auto_invites (client_id, tenant_id)
      SELECT id, tenant_id FROM public.phi_clients
      WHERE id = $1 AND portal_status = 'not_invited'
        AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
      ON CONFLICT (client_id) DO NOTHING RETURNING tenant_id`,
      [clientId, tenantId]
    );
    if (!rows[0]) return;
    await runWithTenant(rows[0].tenant_id, () =>
      new PortalInviteService().inviteClientToPortal(clientId, 'system:auto')
    );
    await getPool().query(
      `UPDATE public.family_auto_invites SET sent_at = now() WHERE client_id = $1 AND tenant_id = $2`,
      [clientId, rows[0].tenant_id]
    );
  } catch {
    logger.warn(
      {
        service: 'portal',
        operation: 'family_auto_invite',
        errorCode: 'AUTO_INVITE_FAILURE',
      },
      'Family auto-invite needs admin review; eligibility was saved'
    );
  }
}
