import { ValidationError } from '../domains/errors';
import { INVITE_BLOCKED_FALLBACK_MESSAGE } from '../features/portal';
import {
  CloudSqlPortalRepository,
  PortalClientRecord,
} from '../repositories/cloudSqlPortalRepository';
import { PortalInviteResult, PortalStatus } from '../types';
import { NodemailerService } from './emailService';
import { getFirebaseAuth } from './identityPlatform/firebaseAdmin';
import { portalEligibilityService } from './portalEligibilityService';

const RATE_LIMIT_MINUTES = 2;
const RATE_LIMIT_MS = RATE_LIMIT_MINUTES * 60 * 1000;

export class PortalInviteService {
  private portalRepository: CloudSqlPortalRepository;
  private emailService: NodemailerService;

  constructor(portalRepository?: CloudSqlPortalRepository) {
    this.portalRepository = portalRepository ?? new CloudSqlPortalRepository();
    this.emailService = new NodemailerService();
  }

  private checkRateLimit(lastInviteSentAt: Date | null | string): boolean {
    if (!lastInviteSentAt) {
      return false;
    }

    const lastSent =
      typeof lastInviteSentAt === 'string'
        ? new Date(lastInviteSentAt)
        : lastInviteSentAt;

    const now = new Date();
    const timeSinceLastInvite = now.getTime() - lastSent.getTime();

    return timeSinceLastInvite < RATE_LIMIT_MS;
  }

  private async ensureEligible(clientId: string): Promise<void> {
    const eligibility =
      await portalEligibilityService.getInviteEligibility(clientId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || INVITE_BLOCKED_FALLBACK_MESSAGE);
    }
  }

  private getClientDisplayName(client: PortalClientRecord): string {
    return (
      `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client'
    );
  }

  private mapResult(
    client: PortalClientRecord,
    fallbackInvitedBy: string
  ): PortalInviteResult {
    return {
      clientId: client.id,
      portalStatus: (client.portal_status || 'not_invited') as PortalStatus,
      invitedAt: client.invited_at ? new Date(client.invited_at) : null,
      lastInviteSentAt: client.last_invite_sent_at
        ? new Date(client.last_invite_sent_at)
        : null,
      inviteSentCount: client.invite_sent_count || 0,
      invitedBy: fallbackInvitedBy,
      authUserId: client.user_id || undefined,
    };
  }

  private getRedirectUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const normalizedUrl = frontendUrl.replace(/\/+$/, '');
    return `${normalizedUrl}/auth/set-password`;
  }

  private async ensureFirebaseUser(
    email: string,
    displayName: string
  ): Promise<string> {
    const auth = getFirebaseAuth();
    try {
      const existing = await auth.getUserByEmail(email);
      return existing.uid;
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code !== 'auth/user-not-found') {
        throw err;
      }
    }

    const created = await auth.createUser({
      email,
      emailVerified: false,
      displayName,
    });
    return created.uid;
  }

  private async buildSetPasswordUrl(email: string): Promise<string> {
    const redirectTo = this.getRedirectUrl();
    const link = await getFirebaseAuth().generatePasswordResetLink(email, {
      url: redirectTo,
    });
    const oobCode = new URL(link).searchParams.get('oobCode');
    if (!oobCode) return link;
    const url = new URL(redirectTo);
    url.searchParams.set('mode', 'resetPassword');
    url.searchParams.set('oobCode', oobCode);
    return url.toString();
  }

  private async sendInvite(client: PortalClientRecord): Promise<string> {
    const authUserId = await this.ensureFirebaseUser(
      client.email!,
      this.getClientDisplayName(client)
    );
    const setPasswordUrl = await this.buildSetPasswordUrl(client.email!);
    await this.emailService.sendPortalInviteEmail(
      client.email!,
      this.getClientDisplayName(client),
      setPasswordUrl
    );
    return authUserId;
  }

  private assertCanSend(client: PortalClientRecord): void {
    if (this.checkRateLimit(client.last_invite_sent_at)) {
      const lastSent = client.last_invite_sent_at
        ? new Date(client.last_invite_sent_at)
        : new Date();
      const waitTime = Math.ceil(
        (RATE_LIMIT_MS - (Date.now() - lastSent.getTime())) / 1000
      );
      throw new Error(
        `Rate limit: Please wait ${waitTime} seconds before sending another invite`
      );
    }
  }

  async inviteClientToPortal(
    clientId: string,
    adminUserId: string
  ): Promise<PortalInviteResult> {
    const client = await this.portalRepository.getClientById(clientId);
    if (!client.email) {
      throw new ValidationError('Client has no email address');
    }
    await this.ensureEligible(clientId);
    this.assertCanSend(client);

    let authUserId: string;
    try {
      authUserId = await this.sendInvite(client);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to invite user: ${message}`);
    }

    const updatedClient = await this.portalRepository.markInvited(
      clientId,
      authUserId
    );
    return this.mapResult(updatedClient, adminUserId);
  }

  async resendPortalInvite(
    clientId: string,
    adminUserId: string
  ): Promise<PortalInviteResult> {
    const client = await this.portalRepository.getClientById(clientId);
    if (!client.email) {
      throw new ValidationError('Client has no email address');
    }
    await this.ensureEligible(clientId);
    this.assertCanSend(client);

    let authUserId: string;
    try {
      authUserId = await this.sendInvite(client);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to resend invite: ${message}`);
    }

    const updatedClient = await this.portalRepository.markInvited(
      clientId,
      authUserId
    );
    return this.mapResult(updatedClient, adminUserId);
  }

  async disablePortalAccess(clientId: string): Promise<PortalInviteResult> {
    const updatedClient = await this.portalRepository.disablePortal(clientId);
    return this.mapResult(updatedClient, '');
  }

  async getPortalStatusByAuthUserId(
    authUserId: string
  ): Promise<PortalClientRecord | null> {
    return this.portalRepository.getClientByAuthUserId(authUserId);
  }
}
