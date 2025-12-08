import { qboRequest } from '../../utils/qboClient';

/**
 * Find an existing customer in QuickBooks by email address
 * @param email Customer email address
 * @returns QuickBooks customer ID if found, null otherwise
 */
export default async function findCustomerInQuickBooks(
  email: string
): Promise<string | null> {
  if (!email) {
    return null;
  }

  try {
    // Query QuickBooks for customer by email
    // QuickBooks uses SQL-like queries
    const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace(/'/g, "''")}'`;
    const encodedQuery = encodeURIComponent(query);

    const response = await qboRequest<{
      QueryResponse?: {
        Customer?: Array<{ Id: string; DisplayName: string }>;
        maxResults?: number;
      };
    }>(`/query?query=${encodedQuery}&minorversion=65`);

    const customers = response.QueryResponse?.Customer;

    if (customers && customers.length > 0) {
      // Return the first matching customer ID
      console.log(`✅ Found existing QuickBooks customer: ${customers[0].Id} for email: ${email}`);
      return customers[0].Id;
    }

    console.log(`ℹ️ No existing QuickBooks customer found for email: ${email}`);
    return null;
  } catch (error: any) {
    console.error('❌ Error searching for customer in QuickBooks:', error);
    // Don't throw - return null so we can create a new customer
    return null;
  }
}
