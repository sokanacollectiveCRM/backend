// src/features/quickbooks/services/invoice/createInvoiceService.ts

import supabase from '../../supabase';
import buildInvoicePayload from './buildInvoicePayload';
import createInvoiceInQuickBooks from './createInvoiceInQuickBooks';
import persistInvoiceToSupabase from './persistInvoiceToSupabase';

export interface CreateInvoiceParams {
  userId: string;
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
  const { userId, internalCustomerId, lineItems, dueDate, memo } = params;

  if (!userId || !internalCustomerId) {
    throw new Error('userId and internalCustomerId are required');
  }

  // 1) Lookup the QBO customer ID and realm ID by your internal UUID
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('qbo_customer_id')
    .eq('id', internalCustomerId)
    .single();
  if (custErr || !cust?.qbo_customer_id) {
    throw new Error(`No QuickBooks customer found for ${internalCustomerId}`);
  }
  const qboCustomerId = cust.qbo_customer_id;

  // Get the realm ID for this user
  const { data: tokens, error: tokenErr } = await supabase
    .from('quickbooks_tokens')
    .select('realm_id')
    .eq('user_id', userId)
    .single();
  if (tokenErr || !tokens?.realm_id) {
    throw new Error('No QuickBooks connection found for this user');
  }
  const realmId = tokens.realm_id;

  // 2) Build the payload using the QBO ID 
  const payload = buildInvoicePayload(qboCustomerId, {
    lineItems,
    dueDate,
    memo,
  });

  // 3) Send it to QuickBooks
  const invoice = await createInvoiceInQuickBooks({
    userId,
    realmId,
    payload
  });

  // 4) Persist the result to Supabase, storing your UUID in `customer_id`
  await persistInvoiceToSupabase(internalCustomerId, invoice);

  return invoice;
}
