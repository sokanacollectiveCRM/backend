import supabase from '../../supabase';
import { getPool } from '../../db/cloudSqlPool';
import findCustomerInQuickBooks, { findCustomerInQuickBooksByDisplayName } from './findCustomerInQuickBooks';
import createCustomerInQuickBooks from '../customer/createCustomerInQuickBooks';
import saveQboCustomerId from '../customer/saveQboCustomerId';
import saveQboCustomerIdToPhiClient from '../customer/saveQboCustomerIdToPhiClient';
import buildCustomerPayload from '../customer/buildCustomerPayload';
import { isConnected } from '../auth/quickbooksAuthService';

/**
 * Ensure a customer exists in QuickBooks and return their QuickBooks customer ID.
 * Handles phi_clients (Cloud SQL) first, then Supabase customers.
 *
 * @param customerId Internal customer ID (phi_clients.id or customers.id)
 * @returns QuickBooks customer ID
 */
export default async function ensureCustomerInQuickBooks(
  customerId: string
): Promise<string> {
  console.log(`🔍 Ensuring customer ${customerId} exists in QuickBooks...`);

  const connected = await isConnected();
  if (!connected) {
    throw new Error('QuickBooks is not connected. Please connect QuickBooks first.');
  }

  // 1. Try phi_clients (Cloud SQL) first — for Labor Support / phi_contracts flow
  const phiRows = await getPool().query<{ qbo_customer_id: string | null; first_name: string; last_name: string; email: string }>(
    'SELECT qbo_customer_id, first_name, last_name, email FROM phi_clients WHERE id = $1 LIMIT 1',
    [customerId]
  );
  if (phiRows.rows.length > 0) {
    const c = phiRows.rows[0];
    if (c.qbo_customer_id) {
      console.log(`✅ phi_clients already linked to QuickBooks: ${c.qbo_customer_id}`);
      return c.qbo_customer_id;
    }
    if (c.email) {
      const existingQboId = await findCustomerInQuickBooks(c.email);
      if (existingQboId) {
        await saveQboCustomerIdToPhiClient(customerId, existingQboId);
        console.log(`✅ Linked phi_clients to existing QuickBooks customer: ${existingQboId}`);
        return existingQboId;
      }
    }
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email?.split('@')[0] || 'Customer';
    const existingByDisplayName = await findCustomerInQuickBooksByDisplayName(name);
    if (existingByDisplayName) {
      await saveQboCustomerIdToPhiClient(customerId, existingByDisplayName);
      console.log(`✅ Linked phi_clients to existing QuickBooks customer (by name): ${existingByDisplayName}`);
      return existingByDisplayName;
    }
    // No customer exists in QuickBooks — create new one
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || c.email?.split('@')[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';
    const { payload, fullName: displayName } = buildCustomerPayload(firstName, lastName, c.email || '');

    try {
      const qboCustomer = await createCustomerInQuickBooks(payload);
      await saveQboCustomerIdToPhiClient(customerId, qboCustomer.Id);
      console.log(`✅ Created new QuickBooks customer for phi_clients: ${qboCustomer.Id}`);
      return qboCustomer.Id;
    } catch (createErr: any) {
      if (createErr?.message?.includes('Duplicate Name') || createErr?.message?.includes('Duplicate Name Exists')) {
        const existingQboId = await findCustomerInQuickBooksByDisplayName(displayName);
        if (existingQboId) {
          await saveQboCustomerIdToPhiClient(customerId, existingQboId);
          console.log(`✅ Linked to existing QuickBooks customer (duplicate name): ${existingQboId}`);
          return existingQboId;
        }
      }
      throw createErr;
    }
  }

  // 2. Fall back to Cloud SQL customers (if table exists)
  try {
    const { rows: custRows } = await getPool().query<{ id: string; name: string; email: string; qbo_customer_id: string | null }>(
      `SELECT id, name, email, qbo_customer_id FROM customers WHERE id = $1 LIMIT 1`,
      [customerId]
    );
    if (custRows.length > 0) {
      const customer = custRows[0];
      if (customer.qbo_customer_id) {
        console.log(`✅ Customer already linked to QuickBooks: ${customer.qbo_customer_id}`);
        return customer.qbo_customer_id;
      }
      if (customer.email) {
        const existingQboId = await findCustomerInQuickBooks(customer.email);
        if (existingQboId) {
          await getPool().query(
            'UPDATE customers SET qbo_customer_id = $1, updated_at = NOW() WHERE id = $2',
            [existingQboId, customerId]
          );
          console.log(`✅ Linked to existing QuickBooks customer: ${existingQboId}`);
          return existingQboId;
        }
      }
      const custDisplayName = (customer.name || '').trim() || customer.email?.split('@')[0] || 'Customer';
      const existingByName = await findCustomerInQuickBooksByDisplayName(custDisplayName);
      if (existingByName) {
        await getPool().query(
          'UPDATE customers SET qbo_customer_id = $1, updated_at = NOW() WHERE id = $2',
          [existingByName, customerId]
        );
        console.log(`✅ Linked to existing QuickBooks customer (by name): ${existingByName}`);
        return existingByName;
      }
      // No customer exists in QuickBooks — create new one
      const nameParts = (customer.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || customer.email?.split('@')[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || '';
      const { payload, fullName: displayName } = buildCustomerPayload(firstName, lastName, customer.email || '');
      try {
        const qboCustomer = await createCustomerInQuickBooks(payload);
        await getPool().query(
          'UPDATE customers SET qbo_customer_id = $1, updated_at = NOW() WHERE id = $2',
          [qboCustomer.Id, customerId]
        );
        console.log(`✅ Created new QuickBooks customer: ${qboCustomer.Id}`);
        return qboCustomer.Id;
      } catch (createErr: any) {
        if (createErr?.message?.includes('Duplicate Name') || createErr?.message?.includes('Duplicate Name Exists')) {
          const existingQboId = await findCustomerInQuickBooksByDisplayName(displayName);
          if (existingQboId) {
            await getPool().query(
              'UPDATE customers SET qbo_customer_id = $1, updated_at = NOW() WHERE id = $2',
              [existingQboId, customerId]
            );
            return existingQboId;
          }
        }
        throw createErr;
      }
    }
  } catch (cloudSqlErr: any) {
    if (!cloudSqlErr?.message?.includes('does not exist') && !cloudSqlErr?.message?.includes('relation "customers"')) {
      console.warn('Cloud SQL customers lookup failed:', cloudSqlErr);
    }
  }

  // 3. Fall back to Supabase customers (legacy - table may not exist)
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

  // Search for existing customer in QuickBooks by email
  if (customer.email) {
    const existingQboCustomerId = await findCustomerInQuickBooks(customer.email);
    if (existingQboCustomerId) {
      await saveQboCustomerId(customerId, existingQboCustomerId);
      console.log(`✅ Linked to existing QuickBooks customer: ${existingQboCustomerId}`);
      return existingQboCustomerId;
    }
  }

  // Search by DisplayName before create
  const supabaseDisplayName = (customer.name || '').trim() || customer.email?.split('@')[0] || 'Customer';
  const existingByDisplayName = await findCustomerInQuickBooksByDisplayName(supabaseDisplayName);
  if (existingByDisplayName) {
    await saveQboCustomerId(customerId, existingByDisplayName);
    console.log(`✅ Linked to existing QuickBooks customer (by name): ${existingByDisplayName}`);
    return existingByDisplayName;
  }

  // No customer exists in QuickBooks — create new one
  console.log(`📝 Creating new customer in QuickBooks for: ${customer.name || customer.email}`);
  const nameParts = (customer.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || customer.email?.split('@')[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '';
  const { payload, fullName: displayName } = buildCustomerPayload(firstName, lastName, customer.email || '');

  try {
    const qboCustomer = await createCustomerInQuickBooks(payload);
    await saveQboCustomerId(customerId, qboCustomer.Id);
    console.log(`✅ Created new QuickBooks customer: ${qboCustomer.Id}`);
    return qboCustomer.Id;
  } catch (createErr: any) {
    if (createErr?.message?.includes('Duplicate Name') || createErr?.message?.includes('Duplicate Name Exists')) {
      const existingQboId = await findCustomerInQuickBooksByDisplayName(displayName);
      if (existingQboId) {
        await saveQboCustomerId(customerId, existingQboId);
        console.log(`✅ Linked to existing QuickBooks customer (duplicate name): ${existingQboId}`);
        return existingQboId;
      }
    }
    throw createErr;
  }
}
