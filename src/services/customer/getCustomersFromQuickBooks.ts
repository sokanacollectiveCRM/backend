import { qboRequest } from '../../utils/qboClient';
import { isConnected } from '../auth/quickbooksAuthService';

export interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  Balance?: number;
  BalanceWithJobs?: number;
  Active?: boolean;
}

/**
 * Get all customers from QuickBooks Online
 * @param maxResults Optional limit on number of results (default: 100)
 * @returns Array of QuickBooks customers
 */
export default async function getCustomersFromQuickBooks(
  maxResults: number = 100
): Promise<QuickBooksCustomer[]> {
  console.log('📋 Fetching customers from QuickBooks...');

  // Check if QuickBooks is connected
  const connected = await isConnected();
  if (!connected) {
    throw new Error('QuickBooks is not connected. Please connect QuickBooks first.');
  }

  try {
    // Query QuickBooks for all customers
    // QuickBooks uses SQL-like queries
    const query = `SELECT * FROM Customer WHERE Active = true MAXRESULTS ${maxResults}`;
    const encodedQuery = encodeURIComponent(query);

    const response = await qboRequest<{
      QueryResponse?: {
        Customer?: QuickBooksCustomer[];
        maxResults?: number;
        startPosition?: number;
      };
      time?: string;
    }>(`/query?query=${encodedQuery}&minorversion=65`);

    const customers = response.QueryResponse?.Customer || [];

    console.log(`✅ Found ${customers.length} customers in QuickBooks`);
    return customers;
  } catch (error: any) {
    console.error('❌ Error fetching customers from QuickBooks:', error);
    throw new Error(`Failed to fetch customers from QuickBooks: ${error.message || 'Unknown error'}`);
  }
}
