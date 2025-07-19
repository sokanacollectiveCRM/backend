'use strict';
// src/features/quickbooks/services/invoice/createInvoiceInQuickBooks.ts
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = createInvoiceInQuickBooks;
const qboClient_1 = require('../../utils/qboClient');
async function createInvoiceInQuickBooks(payload) {
  // Create invoice in QuickBooks
  const { Invoice } = await (0, qboClient_1.qboRequest)(
    '/invoice?minorversion=65',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  // Fetch the invoice again with the payment link
  const { Invoice: InvoiceWithLink } = await (0, qboClient_1.qboRequest)(
    `/invoice/${Invoice.Id}?minorversion=65&include=invoiceLink`,
    {
      method: 'GET',
    }
  );
  return InvoiceWithLink;
}
