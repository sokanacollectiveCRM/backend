import { SupabaseClient } from '@supabase/supabase-js';
import { PortalEligibilityService } from './portalEligibilityService';
import { PortalInviteResult, PortalStatus } from '../types';
import { NodemailerService } from './emailService';

const RATE_LIMIT_MINUTES = 2;
const RATE_LIMIT_MS = RATE_LIMIT_MINUTES * 60 * 1000;

export class PortalInviteService {
  private supabaseClient: SupabaseClient;
  private eligibilityService: PortalEligibilityService;
  private emailService: NodemailerService;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.eligibilityService = new PortalEligibilityService(supabaseClient);
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

    const lastSent = typeof lastInviteSentAt === 'string'
      ? new Date(lastInviteSentAt)
      : lastInviteSentAt;

    const now = new Date();
    const timeSinceLastInvite = now.getTime() - lastSent.getTime();

    return timeSinceLastInvite < RATE_LIMIT_MS;
  }

  /**
   * Get redirect URL for portal invite
   */
  private getRedirectUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return `${frontendUrl}/auth/set-password`;
  }

  /**
   * Invite a client to the portal
   * Requires eligibility check and rate limiting
   */
  async inviteClientToPortal(
    clientId: string,
    adminUserId: string,
    clientEmail: string
  ): Promise<PortalInviteResult> {
    console.log(`📧 Inviting client ${clientId} (${clientEmail}) to portal by admin ${adminUserId}`);

    // Step 1: Check eligibility
    const eligibility = await this.eligibilityService.getInviteEligibility(clientId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || 'Client is not eligible for portal invite');
    }

    // Step 2: Get current client data to check rate limit and portal status
    const { data: client, error: clientError } = await this.supabaseClient
      .from('client_info')
      .select('portal_status, invited_at, last_invite_sent_at, invite_sent_count, auth_user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Step 3: Check if disabled (allow re-invite if needed)
    if (client.portal_status === 'disabled') {
      console.log(`⚠️  Client ${clientId} has disabled portal access. Re-enabling for invite.`);
      // Allow re-invite by proceeding
    }

    // Step 4: Check rate limit
    if (this.checkRateLimit(client.last_invite_sent_at)) {
      const lastSent = client.last_invite_sent_at
        ? new Date(client.last_invite_sent_at)
        : new Date();
      const waitTime = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSent.getTime())) / 1000);
      throw new Error(`Rate limit: Please wait ${waitTime} seconds before sending another invite`);
    }

    // Step 5: Create auth user (without sending email) and send invite via Nodemailer
    const redirectTo = this.getRedirectUrl();
    console.log(`🔗 Creating auth user and sending invite via Nodemailer`);

    let authUserId: string | undefined;

    try {
      // Create auth user without sending email (we'll send our own)
      const { data: userData, error: createError } = await this.supabaseClient.auth.admin.createUser({
        email: clientEmail,
        email_confirm: false, // Don't auto-confirm, they'll confirm via password set
        user_metadata: {
          client_id: clientId,
          role: 'client'
        }
      });

      if (createError) {
        // If user already exists, get the existing user
        if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
          console.log(`ℹ️  Auth user already exists, retrieving...`);
          const { data: existingUsers } = await this.supabaseClient.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find((u: any) => u.email === clientEmail);
          if (existingUser) {
            authUserId = existingUser.id;
            console.log(`✅ Found existing auth user: ${authUserId}`);
          } else {
            throw new Error('User email exists but could not find user');
          }
        } else {
          throw createError;
        }
      } else if (userData?.user) {
        authUserId = userData.user.id;
        console.log(`✅ Auth user created: ${authUserId}`);
      }

      // Generate password reset link (this is what they'll use to set password)
      if (authUserId) {
        const { data: linkData, error: linkError } = await this.supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: clientEmail,
          options: {
            redirectTo
          }
        });

        if (linkError) {
          console.error(`❌ Failed to generate password link:`, linkError);
          throw new Error(`Failed to generate password link: ${linkError.message}`);
        }

        const setPasswordUrl = linkData?.properties?.action_link || redirectTo;
        console.log(`✅ Generated password set link`);

        // Get client name for email
        const { data: clientInfo } = await this.supabaseClient
          .from('client_info')
          .select('firstname, lastname')
          .eq('id', clientId)
          .single();

        const clientName = clientInfo
          ? `${clientInfo.firstname || ''} ${clientInfo.lastname || ''}`.trim() || 'Client'
          : 'Client';

        // Send invite email via Nodemailer (same service as lead confirmations)
        await this.emailService.sendPortalInviteEmail(clientEmail, clientName, setPasswordUrl);
        console.log(`✅ Portal invite email sent via Nodemailer to ${clientEmail}`);
      }
    } catch (error: any) {
      console.error(`❌ Error creating user or sending invite:`, error);
      throw new Error(`Failed to invite user: ${error.message}`);
    }

    // Step 6: Update client_info atomically
    const now = new Date().toISOString();
    const updateData: any = {
      portal_status: 'invited' as PortalStatus,
      last_invite_sent_at: now,
      invite_sent_count: (client.invite_sent_count || 0) + 1,
      invited_by: adminUserId
    };

    // Set invited_at only if null (first invite)
    if (!client.invited_at) {
      updateData.invited_at = now;
    }

    // Set auth_user_id if we got it from Supabase
    if (authUserId) {
      updateData.auth_user_id = authUserId;
    }

    const { data: updatedClient, error: updateError } = await this.supabaseClient
      .from('client_info')
      .update(updateData)
      .eq('id', clientId)
      .select('portal_status, invited_at, last_invite_sent_at, invite_sent_count, invited_by, auth_user_id')
      .single();

    if (updateError || !updatedClient) {
      console.error(`❌ Failed to update client portal fields:`, updateError);
      throw new Error(`Failed to update portal status: ${updateError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Portal invite completed for client ${clientId}`);

    return {
      clientId,
      portalStatus: updatedClient.portal_status as PortalStatus,
      invitedAt: updatedClient.invited_at ? new Date(updatedClient.invited_at) : null,
      lastInviteSentAt: updatedClient.last_invite_sent_at ? new Date(updatedClient.last_invite_sent_at) : null,
      inviteSentCount: updatedClient.invite_sent_count || 0,
      invitedBy: updatedClient.invited_by || adminUserId,
      authUserId: updatedClient.auth_user_id || authUserId
    };
  }

  /**
   * Resend portal invite
   * Same as invite but doesn't require eligibility re-check if already invited
   */
  async resendPortalInvite(
    clientId: string,
    adminUserId: string
  ): Promise<PortalInviteResult> {
    console.log(`📧 Resending portal invite for client ${clientId} by admin ${adminUserId}`);

    // Get client email and current status
    const { data: client, error: clientError } = await this.supabaseClient
      .from('client_info')
      .select('email, portal_status, last_invite_sent_at, invite_sent_count, auth_user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    if (!client.email) {
      throw new Error(`Client ${clientId} has no email address`);
    }

    // Check eligibility (still required for resend)
    const eligibility = await this.eligibilityService.getInviteEligibility(clientId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || 'Client is not eligible for portal invite');
    }

    // Check rate limit
    if (this.checkRateLimit(client.last_invite_sent_at)) {
      const lastSent = client.last_invite_sent_at
        ? new Date(client.last_invite_sent_at)
        : new Date();
      const waitTime = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSent.getTime())) / 1000);
      throw new Error(`Rate limit: Please wait ${waitTime} seconds before sending another invite`);
    }

    // Resend invite via Nodemailer (same as initial invite)
    const redirectTo = this.getRedirectUrl();
    let authUserId: string | undefined = client.auth_user_id || undefined;

    try {
      // If auth_user_id exists, user was already created - generate new link
      if (authUserId) {
        const { data: linkData, error: linkError } = await this.supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: client.email,
          options: {
            redirectTo
          }
        });

        if (linkError) {
          console.error(`❌ Failed to generate password link:`, linkError);
          throw new Error(`Failed to generate invite link: ${linkError.message}`);
        }

        const setPasswordUrl = linkData?.properties?.action_link || redirectTo;
        console.log(`✅ Generated password set link for existing user ${authUserId}`);

        // Get client name for email
        const { data: clientInfo } = await this.supabaseClient
          .from('client_info')
          .select('firstname, lastname')
          .eq('id', clientId)
          .single();

        const clientName = clientInfo
          ? `${clientInfo.firstname || ''} ${clientInfo.lastname || ''}`.trim() || 'Client'
          : 'Client';

        // Send invite email via Nodemailer
        await this.emailService.sendPortalInviteEmail(client.email, clientName, setPasswordUrl);
        console.log(`✅ Portal invite email resent via Nodemailer to ${client.email}`);
      } else {
        // No auth user yet, create one (same flow as initial invite)
        const { data: userData, error: createError } = await this.supabaseClient.auth.admin.createUser({
          email: client.email,
          email_confirm: false,
          user_metadata: {
            client_id: clientId,
            role: 'client'
          }
        });

        if (createError) {
          // If user already exists, get the existing user
          if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
            console.log(`ℹ️  Auth user already exists, retrieving...`);
            const { data: existingUsers } = await this.supabaseClient.auth.admin.listUsers();
            const existingUser = existingUsers?.users.find((u: any) => u.email === client.email);
            if (existingUser) {
              authUserId = existingUser.id;
              console.log(`✅ Found existing auth user: ${authUserId}`);
            } else {
              throw new Error('User email exists but could not find user');
            }
          } else {
            throw createError;
          }
        } else if (userData?.user) {
          authUserId = userData.user.id;
          console.log(`✅ Auth user created: ${authUserId}`);
        }

        // Generate link and send email
        if (authUserId) {
          const { data: linkData, error: linkError } = await this.supabaseClient.auth.admin.generateLink({
            type: 'recovery',
            email: client.email,
            options: {
              redirectTo
            }
          });

          if (linkError) {
            throw new Error(`Failed to generate invite link: ${linkError.message}`);
          }

          const setPasswordUrl = linkData?.properties?.action_link || redirectTo;

          const { data: clientInfo } = await this.supabaseClient
            .from('client_info')
            .select('firstname, lastname')
            .eq('id', clientId)
            .single();

          const clientName = clientInfo
            ? `${clientInfo.firstname || ''} ${clientInfo.lastname || ''}`.trim() || 'Client'
            : 'Client';

          await this.emailService.sendPortalInviteEmail(client.email, clientName, setPasswordUrl);
          console.log(`✅ Portal invite email sent via Nodemailer to ${client.email}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error resending invite:`, error);
      throw new Error(`Failed to resend invite: ${error.message}`);
    }

    // Update client_info
    const now = new Date().toISOString();
    const updateData: any = {
      portal_status: 'invited' as PortalStatus,
      last_invite_sent_at: now,
      invite_sent_count: (client.invite_sent_count || 0) + 1,
      invited_by: adminUserId
    };

    if (authUserId && !client.auth_user_id) {
      updateData.auth_user_id = authUserId;
    }

    const { data: updatedClient, error: updateError } = await this.supabaseClient
      .from('client_info')
      .update(updateData)
      .eq('id', clientId)
      .select('portal_status, invited_at, last_invite_sent_at, invite_sent_count, invited_by, auth_user_id')
      .single();

    if (updateError || !updatedClient) {
      console.error(`❌ Failed to update client portal fields:`, updateError);
      throw new Error(`Failed to update portal status: ${updateError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Portal invite resent for client ${clientId}`);

    return {
      clientId,
      portalStatus: updatedClient.portal_status as PortalStatus,
      invitedAt: updatedClient.invited_at ? new Date(updatedClient.invited_at) : null,
      lastInviteSentAt: updatedClient.last_invite_sent_at ? new Date(updatedClient.last_invite_sent_at) : null,
      inviteSentCount: updatedClient.invite_sent_count || 0,
      invitedBy: updatedClient.invited_by || adminUserId,
      authUserId: updatedClient.auth_user_id || authUserId
    };
  }

  /**
   * Disable portal access for a client
   */
  async disablePortalAccess(clientId: string): Promise<PortalInviteResult> {
    console.log(`🚫 Disabling portal access for client ${clientId}`);

    // Get current client data
    const { data: client, error: clientError } = await this.supabaseClient
      .from('client_info')
      .select('auth_user_id, portal_status')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Update portal status to disabled
    const { data: updatedClient, error: updateError } = await this.supabaseClient
      .from('client_info')
      .update({
        portal_status: 'disabled' as PortalStatus
      })
      .eq('id', clientId)
      .select('portal_status, invited_at, last_invite_sent_at, invite_sent_count, invited_by, auth_user_id')
      .single();

    if (updateError || !updatedClient) {
      console.error(`❌ Failed to disable portal access:`, updateError);
      throw new Error(`Failed to disable portal access: ${updateError?.message || 'Unknown error'}`);
    }

    // Optionally ban the auth user if it exists
    if (client.auth_user_id) {
      try {
        // Note: Supabase admin API doesn't have a direct "ban" method in all versions
        // We'll rely on portal_status gating in the application
        // If needed, can use: supabase.auth.admin.updateUserById(auth_user_id, { ban_duration: '876000h' })
        console.log(`ℹ️  Auth user ${client.auth_user_id} exists but relying on portal_status gating`);
      } catch (error: any) {
        console.warn(`⚠️  Could not update auth user (non-critical):`, error.message);
        // Non-critical error, continue
      }
    }

    console.log(`✅ Portal access disabled for client ${clientId}`);

    return {
      clientId,
      portalStatus: updatedClient.portal_status as PortalStatus,
      invitedAt: updatedClient.invited_at ? new Date(updatedClient.invited_at) : null,
      lastInviteSentAt: updatedClient.last_invite_sent_at ? new Date(updatedClient.last_invite_sent_at) : null,
      inviteSentCount: updatedClient.invite_sent_count || 0,
      invitedBy: updatedClient.invited_by || '',
      authUserId: updatedClient.auth_user_id || undefined
    };
  }
}
