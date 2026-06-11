// src/features/quickbooks/services/invoice/createInvoiceService.ts

import { sendInvoiceEmailToCustomer } from '../../services/invoice/sendInvoiceEmail';
import { queryCloudSql } from '../../db/cloudSqlPool';
import buildInvoicePayload from './buildInvoicePayload';
import createInvoiceInQuickBooks from './createInvoiceInQuickBooks';
import { upsertInvoiceToCloudSql } from '../../repositories/cloudSqlInvoiceWriteRepository';

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

  // 1) Lookup the QBO customer ID + customer info from Cloud SQL phi_clients (not Supabase).
  const { rows } = await queryCloudSql<{
    qbo_customer_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>(
    `SELECT qbo_customer_id, first_name, last_name, email
     FROM phi_clients
     WHERE id = $1
     LIMIT 1`,
    [internalCustomerId]
  );

  const cust = rows[0];
  if (!cust?.qbo_customer_id) {
    throw new Error(`No QuickBooks customer found for ${internalCustomerId} (missing qbo_customer_id on phi_clients)`);
  }

  const qboCustomerId = cust.qbo_customer_id;
  const customerName = [cust.first_name, cust.last_name].filter(Boolean).join(' ').trim() || null;
  const customerEmail = cust.email || null;
  console.log('📋 Customer found (Cloud SQL):', { customerName, customerEmail });

  // 2) Build the payload using the QBO ID 
  console.log('🔧 Building invoice payload...');
  const payload = buildInvoicePayload(qboCustomerId, {
    lineItems,
    dueDate,
    memo,
    customerEmail: customerEmail || ''
  });

  // 3) Send it to QuickBooks
  console.log('📤 Creating invoice in QuickBooks...');
  const invoice = await createInvoiceInQuickBooks(payload);
  
  // 4) Persist the ledger row to Cloud SQL (phi_invoices). QuickBooks remains source-of-truth for the invoice object.
  console.log('💾 Saving invoice to Cloud SQL (phi_invoices)...');
  await upsertInvoiceToCloudSql({ internalCustomerId, invoice });

  // 5) 🎯 NEW: Send email to customer (only if email exists and invoice was successful)
  if (customerEmail) {
    try {
      console.log('📧 Sending invoice email to customer...');
      await sendInvoiceEmailToCustomer({
        invoice,
        customerName: customerName || 'Customer',
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
