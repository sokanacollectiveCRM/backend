import nodemailer from 'nodemailer';
import { EmailService } from './interface/emailServiceInterface';

export class NodemailerService implements EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const effectiveHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const effectivePort = parseInt(process.env.EMAIL_PORT || '465', 10);
    const effectiveSecure = process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true;
    const effectiveUser = process.env.EMAIL_USER || 'hello@sokanacollective.com';
    const effectivePass = (process.env.EMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

    // Log the effective config (mask the password) for debugging
    // eslint-disable-next-line no-console
    console.log('Email config:', {
      host: effectiveHost,
      port: effectivePort,
      secure: effectiveSecure,
      user: effectiveUser,
      passwordPreview: effectivePass ? `${effectivePass.slice(0, 2)}***${effectivePass.slice(-2)}` : '<empty>',
      passwordLength: effectivePass.length
    });

    this.transporter = nodemailer.createTransport({
      host: effectiveHost,
      port: effectivePort,
      secure: effectiveSecure,
      auth: {
        user: effectiveUser,
        pass: effectivePass,
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
        from: process.env.EMAIL_FROM || 'Sokana CRM <hello@sokanacollective.com>',
        to,
        subject,
        text,
        html: html || undefined,
      };

      const info = await this.transporter.sendMail(mailOptions);
      // eslint-disable-next-line no-console
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendInvoiceEmail(
    to: string,
    customerName: string,
    invoiceNumber: string,
    amount: string,
    dueDate: string,
    invoicePdfBuffer: Buffer,
    customHtml?: string,
    customText?: string
  ): Promise<void> {
    const subject = `Invoice ${invoiceNumber} from Sokana CRM`;

    // Use custom text content if provided, otherwise use default
    const text = customText || `Dear ${customerName},

Please find attached invoice ${invoiceNumber} for ${amount}.

Invoice Details:
- Invoice Number: ${invoiceNumber}
- Amount: ${amount}
- Due Date: ${dueDate}

Please remit payment by the due date. If you have any questions about this invoice, please contact us.

Thank you for your business!

Best regards,
The Sokana Team`;

    // Use custom HTML content if provided, otherwise use default
    const html = customHtml || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice ${invoiceNumber}</h2>
        <p>Dear ${customerName},</p>
        <p>Please find attached your invoice for <strong>${amount}</strong>.</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Invoice Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin: 10px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</li>
            <li style="margin: 10px 0;"><strong>Amount:</strong> ${amount}</li>
            <li style="margin: 10px 0;"><strong>Due Date:</strong> ${dueDate}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://app.sandbox.qbo.intuit.com/app/invoice?txnId=\${invoice.Id}"
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none;
                    border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Pay Invoice Now
          </a>
        </div>

        <p>Please remit payment by the due date. If you have any questions about this invoice, please contact us.</p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;

    // Check if we're in test mode
    if (process.env.USE_TEST_EMAIL === 'true') {
      console.log('Test email mode enabled - email with attachment not sent');
      console.log({
        to,
        subject,
        text,
        html: 'HTML content available',
        attachments: [
          {
            filename: `invoice-${invoiceNumber}.pdf`,
            content: `Buffer with ${invoicePdfBuffer.length} bytes`
          }
        ]
      });
      return;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'Sokana CRM <noreply@sokanacrm.org>',
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: `invoice-${invoiceNumber}.pdf`,
            content: invoicePdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Invoice email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Failed to send invoice email:', error);
      throw new Error(`Failed to send invoice email: ${error.message}`);
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

  async sendTeamInviteEmail(to: string, firstname: string, lastname: string, role: string): Promise<void> {
    const signupUrl = `${process.env.FRONTEND_URL}/signup`;
    const subject = 'Welcome to the Sokana CRM Team!';
    const text = `Dear ${firstname} ${lastname},\n\nYou have been invited to join the Sokana CRM team as a ${role}. Please fill out the sign up form to create an account and make sure to use this same email address.${signupUrl}\n\nBest regards,\nThe Sokana Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to the Sokana Team!</h2>
        <p>Dear ${firstname} ${lastname},</p>
        <p>We're excited to have you join our team as a ${role}!</p>
        <div>
        <p>Please fill out the</p>
        <a href="${signupUrl}" style="font-weight: bold;">Sign Up Form</a>
        <p> to create a new account and make sure to use this same email address.</p>
        </div>
        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;

    await this.sendEmail(to, subject, text, html);
  }

  async sendDoulaInviteEmail(to: string, firstname: string, lastname: string, inviteToken?: string): Promise<void> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const signupUrl = inviteToken
      ? `${baseUrl}/signup?role=doula&email=${encodeURIComponent(to)}&invite_token=${inviteToken}`
      : `${baseUrl}/signup?role=doula&email=${encodeURIComponent(to)}`;

    const subject = 'Welcome to the Sokana Doula Team!';
    const text = `Dear ${firstname} ${lastname},\n\nYou have been invited to join the Sokana Collective as a doula! We're excited to have you on our team.\n\nPlease complete your profile by clicking the link below:\n${signupUrl}\n\nAfter signing up, you'll be able to:\n- Complete your profile\n- Upload required documents (background checks and licenses)\n- View and manage your assigned clients\n- Log hours and add notes for your clients\n\nPlease make sure to use this email address (${to}) when creating your account.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nThe Sokana Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Welcome to the Sokana Doula Team!</h2>
        <p>Dear ${firstname} ${lastname},</p>
        <p>We're excited to have you join the Sokana Collective as a doula! We're thrilled to have you on our team.</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="margin-top: 0;"><strong>Next Steps:</strong></p>
          <ol style="margin: 0; padding-left: 20px;">
            <li>Complete your profile by clicking the button below</li>
            <li>Upload required documents (background checks and licenses)</li>
            <li>Start viewing and managing your assigned clients</li>
            <li>Log hours and add notes for your clients</li>
          </ol>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${signupUrl}"
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none;
                    border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Complete Your Profile
          </a>
        </div>

        <p><strong>Important:</strong> Please make sure to use this email address (<strong>${to}</strong>) when creating your account.</p>

        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${signupUrl}</p>

        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;

    await this.sendEmail(to, subject, text, html);
  }

  async sendDoulaMatchNotification(
    doulaEmail: string,
    doulaName: string,
    clientName: string,
    clientEmail: string,
    notes?: string
  ): Promise<void> {
    const subject = 'New Client Assignment - Sokana Collective';
    const text = `Dear ${doulaName},\n\nYou have been matched with a new client!\n\nClient Details:\n- Name: ${clientName}\n- Email: ${clientEmail}\n${notes ? `\nAssignment Notes:\n${notes}\n` : ''}\n\nYou can now view this client's information in your doula dashboard and start logging hours and activities.\n\nBest regards,\nThe Sokana Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">New Client Assignment</h2>
        <p>Dear ${doulaName},</p>
        <p>You have been matched with a new client! We're excited for you to begin working together.</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Client Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin: 10px 0;"><strong>Name:</strong> ${clientName}</li>
            <li style="margin: 10px 0;"><strong>Email:</strong> ${clientEmail}</li>
            ${notes ? `<li style="margin: 10px 0;"><strong>Assignment Notes:</strong><br>${notes}</li>` : ''}
          </ul>
        </div>

        <p>You can now view this client's information in your doula dashboard and start logging hours and activities.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/doula/dashboard"
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none;
                    border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            View Dashboard
          </a>
        </div>

        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;

    await this.sendEmail(doulaEmail, subject, text, html);
  }

  async sendClientMatchNotification(
    clientEmail: string,
    clientName: string,
    doulaName: string,
    doulaEmail: string
  ): Promise<void> {
    const subject = 'Your Doula Match - Sokana Collective';
    const text = `Dear ${clientName},\n\nGreat news! We've matched you with a doula.\n\nDoula Details:\n- Name: ${doulaName}\n- Email: ${doulaEmail}\n\nYour doula will be in touch with you soon to discuss your needs and begin providing support.\n\nBest regards,\nThe Sokana Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Your Doula Match</h2>
        <p>Dear ${clientName},</p>
        <p>Great news! We've matched you with a doula who will support you through your journey.</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Your Doula:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin: 10px 0;"><strong>Name:</strong> ${doulaName}</li>
            <li style="margin: 10px 0;"><strong>Email:</strong> ${doulaEmail}</li>
          </ul>
        </div>

        <p>Your doula will be in touch with you soon to discuss your needs and begin providing support.</p>

        <p>If you have any questions, please don't hesitate to reach out to us.</p>

        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;

    await this.sendEmail(clientEmail, subject, text, html);
  }
}
