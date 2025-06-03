// src/features/quickbooks/services/invoice/persistInvoiceToSupabase.ts
import supabase from '../../supabase';

export default async function persistInvoiceToSupabase(
  internalCustomerId: string,
  invoice: any
): Promise<void> {
  // Destructure only the fields your table defines
  const {
    Id: quickbooks_id,
    DocNumber: doc_number,
    TxnDate: txn_date,
    DueDate: due_date,
    TotalAmt: total_amt,
    PrivateNote: memo,
    Line: line_items,
    Balance,
    MetaData,
  } = invoice;

  // Determine invoice status
  const status = Balance === 0 ? 'paid' : 'sent';

  // Grab the metadata timestamps if you want them
  const created_at = MetaData?.CreateTime;
  const updated_at = MetaData?.LastUpdatedTime;

  const { error } = await supabase
    .from('quickbooks_invoices')
    .upsert(
      {
        quickbooks_id,      // PK/unique key
        customer_id: internalCustomerId,
        doc_number,
        txn_date,
        due_date,
        total_amt,
        memo,
        status,
        line_items,         // JSONB array of line items
        created_at,
        updated_at,
      },
      { onConflict: 'quickbooks_id' }
    );

  if (error) {
    throw new Error(`Supabase error saving invoice: ${error.message}`);
  }
}
