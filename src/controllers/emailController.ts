import { Request, Response } from 'express';

import { logger } from '../common/utils/logger';
import {
  SAFE_INTERNAL_ERROR_MESSAGE,
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';
import { NodemailerService } from '../services/emailService';

export class EmailController {
  private emailService: NodemailerService;

  constructor() {
    this.emailService = new NodemailerService();
  }

  async sendClientApproval(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, signupUrl } = req.body;

      if (!email || !name || !signupUrl) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: email, name, or signupUrl',
        });
        return;
      }

      await this.emailService.sendClientApprovalEmail(email, name, signupUrl);

      res.status(200).json({
        success: true,
        message: `Approval email sent to ${email}`,
      });
    } catch (error) {
      logger.error(
        toSafeProviderError('email', 'client_approval', error),
        'Error sending approval email'
      );
      // Security bug fix (PR 3): do not return raw SMTP/provider messages.
      res.status(500).json(toSafeClientErrorBody('Failed to send email'));
    }
  }

  async sendTeamInvite(req: Request, res: Response): Promise<void> {
    try {
      const { email, firstname, lastname, role } = req.body;

      if (!email || !firstname || !lastname || !role) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: email, firstname, lastname, or role',
        });
        return;
      }

      await this.emailService.sendTeamInviteEmail(
        email,
        firstname,
        lastname,
        role
      );

      res.status(200).json({
        success: true,
        message: `Invite email sent to ${email}`,
      });
    } catch (error) {
      logger.error(
        toSafeProviderError('email', 'team_invite', error),
        'Error sending team invite email'
      );
      // Security bug fix (PR 3): remove stack / raw SMTP messages from client response.
      res.status(500).json(toSafeClientErrorBody(SAFE_INTERNAL_ERROR_MESSAGE));
    }
  }

  async sendDoulaInvite(
    email: string,
    firstname: string,
    lastname: string,
    inviteToken?: string
  ): Promise<void> {
    await this.emailService.sendDoulaInviteEmail(
      email,
      firstname,
      lastname,
      inviteToken
    );
  }

  async sendDoulaMatchNotification(
    doulaEmail: string,
    doulaName: string,
    clientName: string,
    clientEmail: string,
    notes?: string
  ): Promise<void> {
    await this.emailService.sendDoulaMatchNotification(
      doulaEmail,
      doulaName,
      clientName,
      clientEmail,
      notes
    );
  }

  async sendClientMatchNotification(
    clientEmail: string,
    clientName: string,
    doulaName: string,
    doulaEmail: string
  ): Promise<void> {
    await this.emailService.sendClientMatchNotification(
      clientEmail,
      clientName,
      doulaName,
      doulaEmail
    );
  }
}
