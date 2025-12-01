import supabase from '../../supabase';
import findCustomerInQuickBooks from './findCustomerInQuickBooks';
import createCustomerInQuickBooks from '../customer/createCustomerInQuickBooks';
import saveQboCustomerId from '../customer/saveQboCustomerId';
import buildCustomerPayload from '../customer/buildCustomerPayload';
import { isConnected } from '../auth/quickbooksAuthService';

/**
 * Ensure a customer exists in QuickBooks and return their QuickBooks customer ID.
 * Handles both existing QuickBooks customers and new customers.
 *
 * @param customerId Internal customer ID from database
 * @returns QuickBooks customer ID
 */
export default async function ensureCustomerInQuickBooks(
  customerId: string
): Promise<string> {
  console.log(`🔍 Ensuring customer ${customerId} exists in QuickBooks...`);

  // Check if QuickBooks is connected
  const connected = await isConnected();
  if (!connected) {
    throw new Error('QuickBooks is not connected. Please connect QuickBooks first.');
  }

  // 1. Check if customer already has qbo_customer_id in database
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, email, qbo_customer_id')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    throw new Error(`Customer not found: ${customerError?.message || 'Unknown error'}`);
  }

  // If customer already has QuickBooks ID, return it
  if (customer.qbo_customer_id) {
    console.log(`✅ Customer already linked to QuickBooks: ${customer.qbo_customer_id}`);
    return customer.qbo_customer_id;
  }

  // 2. Search for existing customer in QuickBooks by email
  if (customer.email) {
    const existingQboCustomerId = await findCustomerInQuickBooks(customer.email);
    if (existingQboCustomerId) {
      // Save the mapping for future use
      await saveQboCustomerId(customerId, existingQboCustomerId);
      console.log(`✅ Linked to existing QuickBooks customer: ${existingQboCustomerId}`);
      return existingQboCustomerId;
    }
  }

  // 3. Customer doesn't exist in QuickBooks - create new customer
  console.log(`📝 Creating new customer in QuickBooks for: ${customer.name || customer.email}`);

  // Parse name into first and last name
  const nameParts = (customer.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || customer.email?.split('@')[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Build customer payload
  const { payload } = buildCustomerPayload(
    firstName,
    lastName,
    customer.email || ''
  );

  // Create customer in QuickBooks
  const qboCustomer = await createCustomerInQuickBooks(payload);

  // Save QuickBooks customer ID
  await saveQboCustomerId(customerId, qboCustomer.Id);

  console.log(`✅ Created new QuickBooks customer: ${qboCustomer.Id}`);
  return qboCustomer.Id;
}
