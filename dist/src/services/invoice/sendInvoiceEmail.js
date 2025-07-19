'use strict';
// import { generateInvoicePDF, InvoiceData } from '../../utils/generateInvoicePdf';
Object.defineProperty(exports, '__esModule', { value: true });
exports.sendInvoiceEmailToCustomer = sendInvoiceEmailToCustomer;
const generateInvoicePdf_1 = require('../../utils/generateInvoicePdf');
const emailService_1 = require('../emailService');
/**
 * Send invoice email with PDF attachment and payment link to customer
 */
async function sendInvoiceEmailToCustomer(params) {
  const { invoice, customerName, customerEmail, lineItems, dueDate, memo } =
    params;
  console.log('📧 Preparing invoice email for:', customerEmail);
  const emailService = new emailService_1.NodemailerService();
  // Get the payment link from QuickBooks response
  const qboPaymentLink = invoice.invoiceLink;
  if (!qboPaymentLink) {
    console.warn(
      '⚠️ No payment link available for invoice. Make sure "Accept Credit Cards" is enabled in QuickBooks and the invoice has an email address.'
    );
  }
  console.log('🔗 QuickBooks payment link:', qboPaymentLink);
  // Convert QuickBooks line items to our PDF format
  const convertedLineItems = lineItems.map((item) => ({
    description: item.Description || 'Service',
    quantity: item.SalesItemLineDetail?.Qty || 1,
    rate: item.SalesItemLineDetail?.UnitPrice || 0,
    amount: item.Amount || 0,
  }));
  // Calculate totals
  const subtotal = convertedLineItems.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const total = subtotal;
  // Get invoice number from QuickBooks response
  const invoiceNumber = invoice.DocNumber || `INV-${Date.now()}`;
  console.log('📄 Generating PDF for invoice:', invoiceNumber);
  // Prepare invoice data for PDF generation
  const invoiceData = {
    invoiceNumber,
    customerName,
    customerEmail,
    lineItems: convertedLineItems,
    subtotal,
    total,
    dueDate,
    issueDate: new Date().toISOString().split('T')[0],
    memo,
  };
  try {
    // Generate PDF
    const invoicePdfBuffer = await (0, generateInvoicePdf_1.generateInvoicePDF)(
      invoiceData
    );
    console.log('📨 Sending email with PDF attachment and payment link...');
    // Create HTML content with payment button (only if payment link is available)
    const paymentSection = qboPaymentLink
      ? `
      <div style="text-align: center; margin: 30px 0;">
        <table role="presentation" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #4CAF50; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <a href="${qboPaymentLink}"
                 style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                Pay Invoice Now
              </a>
            </td>
          </tr>
        </table>
      </div>
      
      <p style="color: #666; font-size: 14px;">You can also pay your invoice using this secure link: 
        <a href="${qboPaymentLink}" style="color: #4CAF50; text-decoration: underline;">${qboPaymentLink}</a>
      </p>
    `
      : '';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice ${invoiceNumber}</h2>
        <p>Dear ${customerName},</p>
        <p>Please find attached your invoice for <strong>$${total.toFixed(2)}</strong>.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Invoice Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin: 10px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</li>
            <li style="margin: 10px 0;"><strong>Amount:</strong> $${total.toFixed(2)}</li>
            <li style="margin: 10px 0;"><strong>Due Date:</strong> ${dueDate}</li>
          </ul>
        </div>

        ${paymentSection}
        
        <p>Please remit payment by the due date. If you have any questions about this invoice, please contact us.</p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br>The Sokana Team</p>
      </div>
    `;
    // Create plain text content
    const text = `Dear ${customerName},

Please find attached invoice ${invoiceNumber} for $${total.toFixed(2)}.

Invoice Details:
- Invoice Number: ${invoiceNumber}
- Amount: $${total.toFixed(2)}
- Due Date: ${dueDate}
${qboPaymentLink ? `\nYou can pay your invoice using this secure link:\n${qboPaymentLink}` : ''}

Please remit payment by the due date. If you have any questions about this invoice, please contact us.

Thank you for your business!

Best regards,
The Sokana Team`;
    // Send email with both PDF attachment and payment link
    await emailService.sendInvoiceEmail(
      customerEmail,
      customerName,
      invoiceNumber,
      `$${total.toFixed(2)}`,
      dueDate,
      invoicePdfBuffer,
      html,
      text
    );
    console.log('✅ Invoice email sent successfully with payment link!');
  } catch (error) {
    console.error('❌ Error sending invoice email:', error);
    throw error;
  }
}
