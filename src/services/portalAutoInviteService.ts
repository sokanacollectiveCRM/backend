import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import {
  CloudSqlPortalRepository,
  PortalClientRecord,
} from '../repositories/cloudSqlPortalRepository';
import { getSupabaseAdmin } from '../supabase';
import { portalEligibilityService } from './portalEligibilityService';
import { PortalInviteService } from './portalInviteService';

export const SYSTEM_PORTAL_INVITE_ACTOR = 'system:portal-auto-invite';

export interface PortalAutoInviteResult {
  sent: boolean;
  reason?: string;
}

function isAutoInviteEnabled(): boolean {
  return process.env.PORTAL_AUTO_INVITE_ENABLED !== 'false';
}

function canAutoInvitePortalStatus(
  portalStatus: PortalClientRecord['portal_status']
): boolean {
  return !portalStatus || portalStatus === 'not_invited';
}

export async function tryAutoPortalInvite(
  clientId: string,
  options?: { eventSource?: string; actorId?: string }
): Promise<PortalAutoInviteResult> {
  if (!isAutoInviteEnabled()) {
    return { sent: false, reason: 'auto_invite_disabled' };
  }

  const repository = new CloudSqlPortalRepository();
  const client = await repository.getClientById(clientId);

  if (!client.email?.trim()) {
    return { sent: false, reason: 'missing_client_email' };
  }

  if (client.portal_status === 'disabled') {
    return { sent: false, reason: 'portal_disabled' };
  }

  if (!canAutoInvitePortalStatus(client.portal_status)) {
    return { sent: false, reason: 'already_invited_or_active' };
  }

  const eligibility =
    await portalEligibilityService.getInviteEligibility(clientId);
  if (!eligibility.eligible) {
    return {
      sent: false,
      reason: eligibility.reason || 'not_portal_eligible',
    };
  }

  const inviteService = new PortalInviteService(getSupabaseAdmin(), repository);
  await inviteService.inviteClientToPortal(
    clientId,
    options?.actorId ?? SYSTEM_PORTAL_INVITE_ACTOR
  );

  await clientOnboardingReadinessRepository.recordEvent({
    client_id: clientId,
    event_type: 'portal_auto_invite_sent',
    event_source: options?.eventSource ?? 'portal_auto_invite_service',
  });

  return { sent: true };
}
