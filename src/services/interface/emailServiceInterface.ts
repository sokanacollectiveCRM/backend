export interface EmailService {
  sendEmail(to: string, subject: string, text: string, html?: string): Promise<void>;
  sendInvoiceEmail(
    to: string,
    customerName: string,
    invoiceNumber: string,
    amount: string,
    dueDate: string,
    invoicePdfBuffer: Buffer,
    customHtml?: string,
    customText?: string
  ): Promise<void>;
  sendClientApprovalEmail(to: string, name: string, signupUrl: string): Promise<void>;
  sendTeamInviteEmail(to: string, firstname: string, lastname: string, role: string): Promise<void>;
}