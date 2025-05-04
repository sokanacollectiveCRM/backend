// src/features/quickbooks/services/invoice/createInvoiceInQuickBooks.ts

import { qboRequest } from '../../utils/qboClient';


export default async function createInvoiceInQuickBooks(payload: any): Promise<any> {
  const { Invoice } = await qboRequest(
    '/invoice?minorversion=65',
    {
      method: 'POST',
      body:   JSON.stringify(payload)
    }
  );
  return Invoice;
}
