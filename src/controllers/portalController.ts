import { Response } from 'express';
import { AuthRequest } from '../types';
import { PortalInviteService } from '../services/portalInviteService';
import { NotFoundError, ValidationError } from '../domains/errors';

export class PortalController {
  private portalInviteService: PortalInviteService;

  constructor(
    portalInviteService: PortalInviteService
  ) {
    this.portalInviteService = portalInviteService;
  }

  /**
   * Invite a client to the portal
   * POST /api/admin/clients/:id/portal/invite
   */
  async inviteClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.params.id;
      const adminUser = req.user;

      if (!adminUser || !adminUser.id) {
        res.status(401).json({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' }
        });
        return;
      }

      // Invite client
      const result = await this.portalInviteService.inviteClientToPortal(
        clientId,
        adminUser.id
      );

      // Return success response
      res.status(200).json({
        ok: true,
        lead: {
          id: result.clientId,
          portal_status: result.portalStatus,
          invited_at: result.invitedAt?.toISOString() || null,
          last_invite_sent_at: result.lastInviteSentAt?.toISOString() || null,
          invite_sent_count: result.inviteSentCount,
          invited_by: result.invitedBy,
          auth_user_id: result.authUserId || null
        }
      });
    } catch (error: any) {
      console.error(`❌ Error inviting client ${req.params.id} to portal:`, {
        clientId: req.params.id,
        adminId: req.user?.id,
        error: error.message
      });

      // Handle specific error types
      if (error instanceof NotFoundError) {
        res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: error.message }
        });
        return;
      }

      if (error instanceof ValidationError) {
        res.status(400).json({
          ok: false,
          error: { code: 'INVALID_CLIENT', message: error.message }
        });
        return;
      }

      if (error.message?.includes('not eligible') || error.message?.includes('Invite available')) {
        res.status(409).json({
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: error.message }
        });
        return;
      }

      if (error.message?.includes('Rate limit')) {
        res.status(429).json({
          ok: false,
          error: { code: 'RATE_LIMITED', message: error.message }
        });
        return;
      }

      if (error.message?.includes('Supabase') || error.message?.includes('invite')) {
        res.status(502).json({
          ok: false,
          error: { code: 'INVITE_FAILED', message: error.message }
        });
        return;
      }

      // Generic server error
      res.status(500).json({
        ok: false,
        error: { code: 'SERVER_ERROR', message: error.message || 'Failed to invite client to portal' }
      });
    }
  }

  /**
   * Resend portal invite
   * POST /api/admin/clients/:id/portal/resend
   */
  async resendInvite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.params.id;
      const adminUser = req.user;

      if (!adminUser || !adminUser.id) {
        res.status(401).json({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' }
        });
        return;
      }

      // Resend invite
      const result = await this.portalInviteService.resendPortalInvite(
        clientId,
        adminUser.id
      );

      // Return success response
      res.status(200).json({
        ok: true,
        lead: {
          id: result.clientId,
          portal_status: result.portalStatus,
          invited_at: result.invitedAt?.toISOString() || null,
          last_invite_sent_at: result.lastInviteSentAt?.toISOString() || null,
          invite_sent_count: result.inviteSentCount,
          invited_by: result.invitedBy,
          auth_user_id: result.authUserId || null
        }
      });
    } catch (error: any) {
      console.error(`❌ Error resending invite for client ${req.params.id}:`, {
        clientId: req.params.id,
        adminId: req.user?.id,
        error: error.message
      });

      // Handle specific error types
      if (error instanceof NotFoundError) {
        res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: error.message }
        });
        return;
      }

      if (error instanceof ValidationError) {
        res.status(400).json({
          ok: false,
          error: { code: 'INVALID_CLIENT', message: error.message }
        });
        return;
      }

      if (error.message?.includes('not eligible') || error.message?.includes('Invite available')) {
        res.status(409).json({
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: error.message }
        });
        return;
      }

      if (error.message?.includes('Rate limit')) {
        res.status(429).json({
          ok: false,
          error: { code: 'RATE_LIMITED', message: error.message }
        });
        return;
      }

      if (error.message?.includes('Supabase') || error.message?.includes('invite')) {
        res.status(502).json({
          ok: false,
          error: { code: 'INVITE_FAILED', message: error.message }
        });
        return;
      }

      // Generic server error
      res.status(500).json({
        ok: false,
        error: { code: 'SERVER_ERROR', message: error.message || 'Failed to resend portal invite' }
      });
    }
  }

  /**
   * Get portal status for authenticated client
   * GET /api/clients/me/portal-status
   */
  async getMyPortalStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user || !user.id) {
        res.status(401).json({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
        return;
      }

      console.log(`Getting portal status`, { userId: user.id });
      const client = await this.portalInviteService.getPortalStatusByAuthUserId(user.id);
      if (!client) {
        // Client not found - might not be a portal user
        res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Client portal record not found' }
        });
        return;
      }

      // Check if portal is disabled
      if (client.portal_status === 'disabled') {
        res.status(403).json({
          ok: false,
          error: { code: 'PORTAL_DISABLED', message: 'Portal access has been disabled' },
          portal_status: client.portal_status
        });
        return;
      }

      res.status(200).json({
        ok: true,
        portal_status: client.portal_status,
        invited_at: client.invited_at,
        last_invite_sent_at: client.last_invite_sent_at,
        invite_sent_count: client.invite_sent_count,
        last_login_at: null
      });
    } catch (error: any) {
      console.error(`❌ Error getting portal status:`, {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        ok: false,
        error: { code: 'SERVER_ERROR', message: error.message || 'Failed to get portal status' }
      });
    }
  }

  /**
   * Disable portal access
   * POST /api/admin/clients/:id/portal/disable
   */
  async disableAccess(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.params.id;
      const adminUser = req.user;

      if (!adminUser || !adminUser.id) {
        res.status(401).json({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' }
        });
        return;
      }

      // Disable access
      const result = await this.portalInviteService.disablePortalAccess(clientId);

      // Return success response
      res.status(200).json({
        ok: true,
        lead: {
          id: result.clientId,
          portal_status: result.portalStatus,
          invited_at: result.invitedAt?.toISOString() || null,
          last_invite_sent_at: result.lastInviteSentAt?.toISOString() || null,
          invite_sent_count: result.inviteSentCount,
          invited_by: result.invitedBy,
          auth_user_id: result.authUserId || null
        }
      });
    } catch (error: any) {
      console.error(`❌ Error disabling portal access for client ${req.params.id}:`, {
        clientId: req.params.id,
        adminId: req.user?.id,
        error: error.message
      });

      if (error instanceof NotFoundError) {
        res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: error.message }
        });
        return;
      }

      res.status(500).json({
        ok: false,
        error: { code: 'SERVER_ERROR', message: error.message || 'Failed to disable portal access' }
      });
    }
  }
}
