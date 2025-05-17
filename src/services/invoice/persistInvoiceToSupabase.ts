// src/features/quickbooks/services/invoice/persistInvoiceToSupabase.ts

import supabase from '../../supabase';

export default async function persistInvoiceToSupabase(
  internalCustomerId: string,
  invoice: any
): Promise<void> {
  const { error } = await supabase
    .from('quickbooks_invoices')
    .upsert(
      {
        quickbooks_id: invoice.Id,        // your PK or unique key
        customer_id:   internalCustomerId,// your UUID FK
        doc_number:    invoice.DocNumber,
        txn_date:      invoice.TxnDate,
        due_date:      invoice.DueDate,
        total_amt:     invoice.TotalAmt
      },
      { onConflict: 'quickbooks_id' }
    );

  if (error) {
    throw new Error(`Supabase error saving invoice: ${error.message}`);
  }
}
