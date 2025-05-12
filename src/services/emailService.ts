import nodemailer from 'nodemailer';
import { EmailService } from './interface/emailServiceInterface';

export class NodemailerService implements EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
    // Check if we're in test mode
    if (process.env.USE_TEST_EMAIL === 'true') {
      console.log('Test email mode enabled - email not sent');
      console.log({
        to,
        subject,
        text,
        html: html ? 'HTML content available' : 'No HTML content'
      });
      return;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'Sokana CRM <noreply@sokanacrm.org>',
        to,
        subject,
        text,
        html: html || undefined,
      };

      const info = await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendClientApprovalEmail(to: string, name: string, signupUrl: string): Promise<void> {
    const subject = 'Your Sokana CRM Account Request Has Been Approved';
    const text = `Dear ${name},\n\nYour request for Sokana services has been approved! You can now create an account using the following link: ${signupUrl}\n\nBest regards,\nThe Sokana Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Sokana!</h2>
        <p>Dear ${name},</p>
        <p>We're pleased to inform you that your service request has been approved!</p>
        <p>You can now create your account by clicking the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${signupUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Create Account</a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p>${signupUrl}</p>
        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;
    
    await this.sendEmail(to, subject, text, html);
  }
}