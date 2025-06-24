// src/features/quickbooks/services/invoice/createInvoiceInQuickBooks.ts

import { qboRequest } from '../../utils/qboClient';

export default async function createInvoiceInQuickBooks(
  payload: any
): Promise<any> {
  // Create invoice in QuickBooks
  const { Invoice } = await qboRequest(
    '/invoice?minorversion=65',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

  // Fetch the invoice again with the payment link
  const { Invoice: InvoiceWithLink } = await qboRequest(
    `/invoice/${Invoice.Id}?minorversion=65&include=invoiceLink`,
    {
      method: 'GET'
    }
  );

  return InvoiceWithLink;
}
