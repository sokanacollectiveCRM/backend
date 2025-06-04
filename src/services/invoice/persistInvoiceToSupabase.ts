// src/features/quickbooks/services/invoice/persistInvoiceToSupabase.ts
import supabase from '../../supabase';

export default async function persistInvoiceToSupabase(
  internalCustomerId: string,
  invoice: any
): Promise<void> {
  // Destructure only the fields your table defines
  const {
    DueDate: due_date,
    PrivateNote: memo,
    Line: line_items,
    Balance,
  } = invoice;

  // Determine invoice status based on balance
  const status = Balance === 0 ? 'paid' : 'pending';

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('invoices')
    .insert({
      customer_id: internalCustomerId,
      line_items,                  // JSONB array of line items
      due_date,
      memo: memo || null,
      status,
      created_at: now,
      updated_at: now
    });

  if (error) {
    throw new Error(`Supabase error saving invoice: ${error.message}`);
  }
}
