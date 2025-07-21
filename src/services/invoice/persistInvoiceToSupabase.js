'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = persistInvoiceToSupabase;
// src/features/quickbooks/services/invoice/persistInvoiceToSupabase.ts
const supabase_1 = __importDefault(require('../../supabase'));
async function persistInvoiceToSupabase(internalCustomerId, invoice) {
  console.log('💾 [Invoice] Persisting invoice data to Supabase...');
  console.log(
    '📋 [Invoice] QuickBooks invoice data:',
    JSON.stringify(invoice, null, 2)
  );
  // Destructure the fields from QuickBooks invoice response
  const {
    DocNumber: doc_number,
    TotalAmt: total_amount,
    Balance: balance,
    DueDate: due_date,
    PrivateNote: memo,
    Line: line_items,
  } = invoice;
  // Determine invoice status based on balance
  const status = balance === 0 ? 'paid' : 'pending';
  const now = new Date().toISOString();
  console.log('📊 [Invoice] Saving invoice with fields:', {
    customer_id: internalCustomerId,
    doc_number,
    total_amount,
    balance,
    due_date,
    status,
    line_items_count: line_items?.length || 0,
  });
  const { error } = await supabase_1.default.from('invoices').insert({
    customer_id: internalCustomerId,
    doc_number, // QuickBooks document number
    total_amount, // Total invoice amount
    balance, // Outstanding balance
    line_items, // JSONB array of line items
    due_date,
    memo: memo || null,
    status,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    console.error('❌ [Invoice] Supabase error:', error);
    throw new Error(`Supabase error saving invoice: ${error.message}`);
  }
  console.log('✅ [Invoice] Invoice saved successfully to Supabase');
}
