// src/features/quickbooks/services/invoice/createInvoiceService.ts

import { sendInvoiceEmailToCustomer } from '../../services/invoice/sendInvoiceEmail';
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
 * Build, send, and persist a QuickBooks invoice, then email it to the customer
 */
export default async function createInvoiceService(
  params: CreateInvoiceParams
): Promise<any> {
  const { userId, internalCustomerId, lineItems, dueDate, memo } = params;

  if (!userId || !internalCustomerId) {
    throw new Error('userId and internalCustomerId are required');
  }

  console.log('🚀 Invoice creation started for customer:', internalCustomerId);

  // 1) Lookup the QBO customer ID AND customer info for email
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('qbo_customer_id, name, email')
    .eq('id', internalCustomerId)
    .single();
    
  if (custErr || !cust?.qbo_customer_id) {
    throw new Error(`No QuickBooks customer found for ${internalCustomerId}`);
  }
  
  const { qbo_customer_id: qboCustomerId, name: customerName, email: customerEmail } = cust;
  console.log('📋 Customer found:', { customerName, customerEmail });

  // 2) Build the payload using the QBO ID 
  console.log('🔧 Building invoice payload...');
  const payload = buildInvoicePayload(qboCustomerId, {
    lineItems,
    dueDate,
    memo,
  });

  // 3) Send it to QuickBooks
  console.log('📤 Creating invoice in QuickBooks...');
  const invoice = await createInvoiceInQuickBooks(payload);
  
  // 4) Persist the result to Supabase, storing your UUID in `customer_id`
  console.log('💾 Saving invoice to Supabase...');
  await persistInvoiceToSupabase(internalCustomerId, invoice);

  // 5) 🎯 NEW: Send email to customer (only if email exists and invoice was successful)
  if (customerEmail) {
    try {
      console.log('📧 Sending invoice email to customer...');
      await sendInvoiceEmailToCustomer({
        invoice,
        customerName,
        customerEmail,
        lineItems,
        dueDate,
        memo
      });
      console.log('✅ Invoice email sent successfully to:', customerEmail);
    } catch (emailError) {
      console.error('❌ Failed to send invoice email:', emailError);
      // Don't throw here - we want the invoice creation to succeed even if email fails
      console.warn('⚠️ Invoice created successfully but email failed to send');
    }
  } else {
    console.warn('⚠️ No email found for customer, skipping email notification');
  }

  console.log('✅ Invoice creation completed successfully!');
  return invoice;
}
