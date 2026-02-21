import { SupabaseClient } from '@supabase/supabase-js';

import { PortalInviteResult, PortalStatus } from '../types';
import { NodemailerService } from './emailService';
import { CloudSqlPortalRepository, PortalClientRecord } from '../repositories/cloudSqlPortalRepository';
import { ValidationError } from '../domains/errors';

const RATE_LIMIT_MINUTES = 2;
const RATE_LIMIT_MS = RATE_LIMIT_MINUTES * 60 * 1000;

export class PortalInviteService {
  private supabaseClient: SupabaseClient;
  private portalRepository: CloudSqlPortalRepository;
  private emailService: NodemailerService;

  constructor(supabaseClient: SupabaseClient, portalRepository?: CloudSqlPortalRepository) {
    this.supabaseClient = supabaseClient;
    this.portalRepository = portalRepository ?? new CloudSqlPortalRepository();
    this.emailService = new NodemailerService();
  }

  /**
   * Check rate limit for invite/resend operations
   * Returns true if rate limited (should not proceed)
   */
  private checkRateLimit(lastInviteSentAt: Date | null | string): boolean {
    if (!lastInviteSentAt) {
      return false; // No previous invite, not rate limited
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
    const hasSignedContract = await this.portalRepository.hasSignedContract(clientId);
    if (!hasSignedContract) {
      throw new Error('Invite available after contract is signed and first payment is completed.');
    }
    const hasCompletedFirstPayment = await this.portalRepository.hasCompletedFirstPayment(clientId);
    if (!hasCompletedFirstPayment) {
      throw new Error('Invite available after contract is signed and first payment is completed.');
    }
  }

  private getClientDisplayName(client: PortalClientRecord): string {
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
  }

  private mapResult(client: PortalClientRecord, fallbackInvitedBy: string): PortalInviteResult {
    return {
      clientId: client.id,
      portalStatus: (client.portal_status || 'not_invited') as PortalStatus,
      invitedAt: client.invited_at ? new Date(client.invited_at) : null,
      lastInviteSentAt: client.last_invite_sent_at ? new Date(client.last_invite_sent_at) : null,
      inviteSentCount: client.invite_sent_count || 0,
      invitedBy: fallbackInvitedBy,
      authUserId: client.user_id || undefined,
    };
  }

  /**
   * Get redirect URL for portal invite
   * Normalizes the URL by removing trailing slashes
   */
  private getRedirectUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    // Remove trailing slash if present, then append path
    const normalizedUrl = frontendUrl.replace(/\/+$/, '');
    const redirectUrl = `${normalizedUrl}/auth/set-password`;
    console.log(`🔗 Using redirect URL: ${redirectUrl}`);
    return redirectUrl;
  }

  /**
   * Invite a client to the portal
   * Requires eligibility check and rate limiting
   */
  async inviteClientToPortal(
    clientId: string,
    adminUserId: string
  ): Promise<PortalInviteResult> {
    console.log(`Portal invite requested`, { clientId, adminUserId });

    const client = await this.portalRepository.getClientById(clientId);
    if (!client.email) {
      throw new ValidationError('Client has no email address');
    }
    await this.ensureEligible(clientId);

    // allow re-invite from disabled state
    if (client.portal_status === 'disabled') {
      console.log(`Portal re-enable via invite`, { clientId });
    }

    // rate-limit invite sends
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

    // Supabase Auth actions only (no Supabase table reads/writes)
    const redirectTo = this.getRedirectUrl();
    let authUserId: string | null = client.user_id || null;

    try {
      if (!authUserId) {
        const { data: userData, error: createError } = await this.supabaseClient.auth.admin.createUser({
          email: client.email,
          email_confirm: false,
          user_metadata: {
            client_id: clientId,
            role: 'client',
          },
        });

        if (createError) {
          if (
            createError.message.includes('already registered') ||
            createError.message.includes('already been registered')
          ) {
            const { data: existingUsers } = await this.supabaseClient.auth.admin.listUsers();
            const existingUser = existingUsers?.users.find((u: any) => u.email === client.email);
            if (!existingUser) {
              throw new Error('User email exists but could not find user');
            }
            authUserId = existingUser.id;
          } else {
            throw createError;
          }
        } else {
          authUserId = userData?.user?.id || null;
        }
      }

      const { data: linkData, error: linkError } = await this.supabaseClient.auth.admin.generateLink({
        type: 'recovery',
        email: client.email,
        options: { redirectTo },
      });
      if (linkError) {
        throw new Error(`Failed to generate password link: ${linkError.message}`);
      }
      const setPasswordUrl = linkData?.properties?.action_link || redirectTo;
      await this.emailService.sendPortalInviteEmail(
        client.email,
        this.getClientDisplayName(client),
        setPasswordUrl
      );
    } catch (error: any) {
      throw new Error(`Failed to invite user: ${error.message}`);
    }

    const updatedClient = await this.portalRepository.markInvited(clientId, authUserId);
    return this.mapResult(updatedClient, adminUserId);
  }

  /**
   * Resend portal invite
   * Same as invite but doesn't require eligibility re-check if already invited
   */
  async resendPortalInvite(
    clientId: string,
    adminUserId: string
  ): Promise<PortalInviteResult> {
    console.log(`Portal resend requested`, { clientId, adminUserId });
    const client = await this.portalRepository.getClientById(clientId);

    if (!client.email) {
      throw new ValidationError('Client has no email address');
    }

    await this.ensureEligible(clientId);

    // Check rate limit
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

    const redirectTo = this.getRedirectUrl();
    let authUserId: string | null = client.user_id || null;

    try {
      if (authUserId) {
        const { data: linkData, error: linkError } = await this.supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: client.email,
          options: { redirectTo },
        });

        if (linkError) {
          throw new Error(`Failed to generate invite link: ${linkError.message}`);
        }
        const setPasswordUrl = linkData?.properties?.action_link || redirectTo;
        await this.emailService.sendPortalInviteEmail(
          client.email,
          this.getClientDisplayName(client),
          setPasswordUrl
        );
      } else {
        const { data: userData, error: createError } = await this.supabaseClient.auth.admin.createUser({
          email: client.email,
          email_confirm: false,
          user_metadata: {
            client_id: clientId,
            role: 'client',
          },
        });

        if (createError) {
          if (
            createError.message.includes('already registered') ||
            createError.message.includes('already been registered')
          ) {
            const { data: existingUsers } = await this.supabaseClient.auth.admin.listUsers();
            const existingUser = existingUsers?.users.find(
              (u: any) => u.email === client.email
            );
            if (existingUser) {
              authUserId = existingUser.id;
            } else {
              throw new Error('User email exists but could not find user');
            }
          } else {
            throw createError;
          }
        } else if (userData?.user) {
          authUserId = userData.user.id;
        }

        const { data: linkData, error: linkError } = await this.supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: client.email,
          options: { redirectTo },
        });
        if (linkError) {
          throw new Error(`Failed to generate invite link: ${linkError.message}`);
        }
        const setPasswordUrl = linkData?.properties?.action_link || redirectTo;
        await this.emailService.sendPortalInviteEmail(
          client.email,
          this.getClientDisplayName(client),
          setPasswordUrl
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to resend invite: ${error.message}`);
    }

    const updatedClient = await this.portalRepository.markInvited(clientId, authUserId);
    return this.mapResult(updatedClient, adminUserId);
  }

  /**
   * Disable portal access for a client
   */
  async disablePortalAccess(clientId: string): Promise<PortalInviteResult> {
    console.log(`Portal disable requested`, { clientId });
    const updatedClient = await this.portalRepository.disablePortal(clientId);
    return this.mapResult(updatedClient, '');
  }

  async getPortalStatusByAuthUserId(authUserId: string): Promise<PortalClientRecord | null> {
    return this.portalRepository.getClientByAuthUserId(authUserId);
  }
}
