'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = createCustomer;
const supabase_js_1 = require('@supabase/supabase-js');
const supabaseUserRepository_1 = require('../../repositories/supabaseUserRepository');
const buildCustomerPayload_1 = __importDefault(
  require('./buildCustomerPayload')
);
const createCustomerInQuickBooks_1 = __importDefault(
  require('./createCustomerInQuickBooks')
);
const saveQboCustomerId_1 = __importDefault(require('./saveQboCustomerId'));
const upsertInternalCustomer_1 = __importDefault(
  require('./upsertInternalCustomer')
);
const supabase = (0, supabase_js_1.createClient)(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const userRepository = new supabaseUserRepository_1.SupabaseUserRepository(
  supabase
);
async function createCustomer(params) {
  const { internalCustomerId, firstName, lastName, email } = params;
  if (!internalCustomerId || !firstName || !lastName || !email) {
    throw new Error('Missing required fields to create customer.');
  }
  // 1) Build payload
  const { fullName, payload } = (0, buildCustomerPayload_1.default)(
    firstName,
    lastName,
    email
  );
  // 2) Upsert internal record
  await (0, upsertInternalCustomer_1.default)(
    internalCustomerId,
    fullName,
    email
  );
  // 3) Create in QuickBooks
  const qboCustomer = await (0, createCustomerInQuickBooks_1.default)(payload);
  // 4) Save QBO customer ID back internally
  await (0, saveQboCustomerId_1.default)(internalCustomerId, qboCustomer.Id);
  // 5) Update client_info status to 'customer'
  await userRepository.updateClientStatusToCustomer(internalCustomerId);
  return { internalCustomerId, qboCustomerId: qboCustomer.Id, fullName };
}
