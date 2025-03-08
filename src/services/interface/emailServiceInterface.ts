export interface EmailService {
  sendEmail(to: string, subject: string, text: string, html?: string): Promise<void>;
  sendClientApprovalEmail(to: string, name: string, signupUrl: string): Promise<void>;
}