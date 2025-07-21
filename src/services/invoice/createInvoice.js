'use strict';
// src/features/quickbooks/services/invoice/createInvoiceService.ts
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = createInvoiceService;
const sendInvoiceEmail_1 = require('../../services/invoice/sendInvoiceEmail');
const supabase_1 = __importDefault(require('../../supabase'));
const buildInvoicePayload_1 = __importDefault(require('./buildInvoicePayload'));
const createInvoiceInQuickBooks_1 = __importDefault(
  require('./createInvoiceInQuickBooks')
);
const persistInvoiceToSupabase_1 = __importDefault(
  require('./persistInvoiceToSupabase')
);
/**
 * Build, send, and persist a QuickBooks invoice, then email it to the customer
 */
async function createInvoiceService(params) {
  const { userId, internalCustomerId, lineItems, dueDate, memo } = params;
  if (!userId || !internalCustomerId) {
    throw new Error('userId and internalCustomerId are required');
  }
  console.log('🚀 Invoice creation started for customer:', internalCustomerId);
  // 1) Lookup the QBO customer ID AND customer info for email
  const { data: cust, error: custErr } = await supabase_1.default
    .from('customers')
    .select('qbo_customer_id, name, email')
    .eq('id', internalCustomerId)
    .single();
  if (custErr || !cust?.qbo_customer_id) {
    throw new Error(`No QuickBooks customer found for ${internalCustomerId}`);
  }
  const {
    qbo_customer_id: qboCustomerId,
    name: customerName,
    email: customerEmail,
  } = cust;
  console.log('📋 Customer found:', { customerName, customerEmail });
  // 2) Build the payload using the QBO ID
  console.log('🔧 Building invoice payload...');
  const payload = (0, buildInvoicePayload_1.default)(qboCustomerId, {
    lineItems,
    dueDate,
    memo,
    customerEmail,
  });
  // 3) Send it to QuickBooks
  console.log('📤 Creating invoice in QuickBooks...');
  const invoice = await (0, createInvoiceInQuickBooks_1.default)(payload);
  // 4) Persist the result to Supabase, storing your UUID in `customer_id`
  console.log('💾 Saving invoice to Supabase...');
  await (0, persistInvoiceToSupabase_1.default)(internalCustomerId, invoice);
  // 5) 🎯 NEW: Send email to customer (only if email exists and invoice was successful)
  if (customerEmail) {
    try {
      console.log('📧 Sending invoice email to customer...');
      await (0, sendInvoiceEmail_1.sendInvoiceEmailToCustomer)({
        invoice,
        customerName,
        customerEmail,
        lineItems,
        dueDate,
        memo,
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
