"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodemailerService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class NodemailerService {
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
    }
    async sendEmail(to, subject, text, html) {
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
        }
        catch (error) {
            console.error('Failed to send email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
    async sendInvoiceEmail(to, customerName, invoiceNumber, amount, dueDate, invoicePdfBuffer, customHtml, customText) {
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
        }
        catch (error) {
            console.error('Failed to send invoice email:', error);
            throw new Error(`Failed to send invoice email: ${error.message}`);
        }
    }
    async sendClientApprovalEmail(to, name, signupUrl) {
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
    async sendTeamInviteEmail(to, firstname, lastname, role) {
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
}
exports.NodemailerService = NodemailerService;
