'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.generateInvoicePDF = generateInvoicePDF;
const pdfkit_1 = __importDefault(require('pdfkit'));
function generateInvoicePDF(invoiceData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new pdfkit_1.default({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      // Company Header
      doc.fontSize(20).text('Sokana CRM', 50, 50);
      doc
        .fontSize(10)
        .text('Professional Services', 50, 75)
        .text('Contact: info@sokanacrm.org', 50, 90);
      // Invoice Title
      doc.fontSize(24).text('INVOICE', 400, 50);
      // Invoice Details
      doc
        .fontSize(12)
        .text(`Invoice #: ${invoiceData.invoiceNumber}`, 400, 80)
        .text(`Issue Date: ${invoiceData.issueDate}`, 400, 100)
        .text(`Due Date: ${invoiceData.dueDate}`, 400, 120);
      // Customer Information
      doc.fontSize(14).text('Bill To:', 50, 150);
      doc
        .fontSize(12)
        .text(invoiceData.customerName, 50, 170)
        .text(invoiceData.customerEmail, 50, 185);
      if (invoiceData.customerAddress) {
        doc.text(invoiceData.customerAddress, 50, 200);
      }
      // Line Items Table
      const tableTop = 250;
      doc.fontSize(12);
      // Table Headers
      doc
        .text('Description', 50, tableTop)
        .text('Qty', 300, tableTop)
        .text('Rate', 350, tableTop)
        .text('Amount', 450, tableTop);
      // Table line
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();
      // Line Items
      let yPosition = tableTop + 30;
      invoiceData.lineItems.forEach((item) => {
        doc
          .text(item.description, 50, yPosition)
          .text(item.quantity.toString(), 300, yPosition)
          .text(`$${item.rate.toFixed(2)}`, 350, yPosition)
          .text(`$${item.amount.toFixed(2)}`, 450, yPosition);
        yPosition += 20;
      });
      // Totals
      const totalsX = 400;
      yPosition += 20;
      doc.text(
        `Subtotal: $${invoiceData.subtotal.toFixed(2)}`,
        totalsX,
        yPosition
      );
      if (invoiceData.tax) {
        yPosition += 20;
        doc.text(`Tax: $${invoiceData.tax.toFixed(2)}`, totalsX, yPosition);
      }
      yPosition += 20;
      doc
        .fontSize(14)
        .text(`Total: $${invoiceData.total.toFixed(2)}`, totalsX, yPosition);
      // Memo
      if (invoiceData.memo) {
        yPosition += 50;
        doc
          .fontSize(12)
          .text('Notes:', 50, yPosition)
          .text(invoiceData.memo, 50, yPosition + 15);
      }
      // Footer
      doc
        .fontSize(10)
        .text('Thank you for your business!', 50, doc.page.height - 100)
        .text(
          'Please remit payment by the due date.',
          50,
          doc.page.height - 85
        );
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
