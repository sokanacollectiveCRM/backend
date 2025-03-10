import { Request, Response } from 'express';
import { NodemailerService } from '../services/EmailService';

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
          error: 'Missing required fields: email, name, or signupUrl' 
        });
        return;
      }

      await this.emailService.sendClientApprovalEmail(
        email,
        name,
        signupUrl
      );

      res.status(200).json({ 
        success: true, 
        message: `Approval email sent to ${email}` 
      });
    } catch (error) {
      console.error('Error sending approval email:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to send email' 
      });
    }
  }
}