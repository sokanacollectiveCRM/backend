'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const supabase_1 = __importDefault(require('../supabase'));
async function checkTables() {
  console.log('Checking database tables...');
  // Check payment_methods table
  const { data: paymentMethodsData, error: paymentMethodsError } =
    await supabase_1.default.from('payment_methods').select('*').limit(1);
  console.log('\nPayment Methods Table:');
  if (paymentMethodsError) {
    console.error('Error:', paymentMethodsError.message);
  } else {
    console.log('✅ Table exists');
  }
  // Check charges table
  const { data: chargesData, error: chargesError } = await supabase_1.default
    .from('charges')
    .select('*')
    .limit(1);
  console.log('\nCharges Table:');
  if (chargesError) {
    console.error('Error:', chargesError.message);
  } else {
    console.log('✅ Table exists');
  }
}
// Run the check
checkTables().catch(console.error);
