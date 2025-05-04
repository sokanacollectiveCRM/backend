// src/features/quickbooks/services/invoice/createInvoiceService.ts

import supabase from '../../supabase';
import buildInvoicePayload from './buildInvoicePayload';
import createInvoiceInQuickBooks from './createInvoiceInQuickBooks';
import persistInvoiceToSupabase from './persistInvoiceToSupabase';

export interface CreateInvoiceParams {
  internalCustomerId: string;
  lineItems: any[];
  dueDate: string;
  memo?: string;
}

/**
 * Build, send, and persist a QuickBooks invoice
 */
export default async function createInvoiceService(
  params: CreateInvoiceParams
): Promise<any> {
  const { internalCustomerId, lineItems, dueDate, memo } = params;

  if (!internalCustomerId) {
    throw new Error('internalCustomerId is required');
  }

  // 1) Lookup the QBO customer ID by your internal UUID
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('qbo_customer_id')
    .eq('id', internalCustomerId)
    .single();
  if (custErr || !cust?.qbo_customer_id) {
    throw new Error(`No QuickBooks customer found for ${internalCustomerId}`);
  }
  const qboCustomerId = cust.qbo_customer_id;

  // 2) Build the payload using the QBO ID
  const payload = buildInvoicePayload(qboCustomerId, {
    lineItems,
    dueDate,
    memo,
  });

  // 3) Send it to QuickBooks
  const invoice = await createInvoiceInQuickBooks(payload);

  // 4) Persist the result to Supabase, storing your UUID in `customer_id`
  await persistInvoiceToSupabase(internalCustomerId, invoice);

  return invoice;
}
