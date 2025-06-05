// import { generateInvoicePDF, InvoiceData } from '../../utils/generateInvoicePdf';

import { generateInvoicePDF, InvoiceData } from '../../utils/generateInvoicePdf';
import { NodemailerService } from '../EmailService';

interface SendInvoiceEmailParams {
  invoice: any;
  customerName: string;
  customerEmail: string;
  lineItems: any[];
  dueDate: string;
  memo?: string;
}

/**
 * Send invoice email with PDF attachment to customer
 */
export async function sendInvoiceEmailToCustomer(params: SendInvoiceEmailParams): Promise<void> {
  const { invoice, customerName, customerEmail, lineItems, dueDate, memo } = params;
  
  console.log('📧 Preparing invoice email for:', customerEmail);
  
  const emailService = new NodemailerService();

  // Convert QuickBooks line items to our PDF format
  const convertedLineItems = lineItems.map(item => ({
    description: item.Description || 'Service',
    quantity: item.SalesItemLineDetail?.Qty || 1,
    rate: item.SalesItemLineDetail?.UnitPrice || 0,
    amount: item.Amount || 0
  }));

  // Calculate totals
  const subtotal = convertedLineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal; // Add tax calculation here if needed

  // Get invoice number from QuickBooks response
  const invoiceNumber = invoice.DocNumber || `INV-${Date.now()}`;
  
  console.log('📄 Generating PDF for invoice:', invoiceNumber);

  // Prepare invoice data for PDF generation
  const invoiceData: InvoiceData = {
    invoiceNumber,
    customerName,
    customerEmail,
    lineItems: convertedLineItems,
    subtotal,
    total,
    dueDate,
    issueDate: new Date().toISOString().split('T')[0],
    memo
  };

  // Generate PDF
  const invoicePdfBuffer = await generateInvoicePDF(invoiceData);

  console.log('📨 Sending email with PDF attachment...');
  
  // Send email with attachment
  await emailService.sendInvoiceEmail(
    customerEmail,
    customerName,
    invoiceNumber,
    `$${total.toFixed(2)}`,
    dueDate,
    invoicePdfBuffer
  );
  
  console.log('✅ Email sent successfully!');
} 