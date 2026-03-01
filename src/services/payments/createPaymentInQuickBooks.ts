import { qboRequest } from '../../utils/qboClient';
import ensureCustomerInQuickBooks from './ensureCustomerInQuickBooks';
import { isConnected } from '../auth/quickbooksAuthService';

export interface PaymentData {
  customerId: string; // Internal customer ID
  amount: number; // Amount in cents (from Stripe)
  stripePaymentIntentId: string;
  description?: string;
  paymentDate?: string; // ISO date string, defaults to today
}

/**
 * Record a payment in QuickBooks Online.
 * Uses SalesReceipt (not Payment) because we're recording payment received at time of sale
 * without an invoice. Payment entity requires invoice linkage.
 *
 * @param paymentData Payment information
 * @returns QuickBooks SalesReceipt ID if successful, null if failed
 */
export default async function createPaymentInQuickBooks(
  paymentData: PaymentData
): Promise<string | null> {
  const { customerId, amount, stripePaymentIntentId, description, paymentDate } = paymentData;

  try {
    console.log(`💰 Recording payment in QuickBooks for customer: ${customerId}`);

    const connected = await isConnected();
    if (!connected) {
      console.warn('⚠️ QuickBooks is not connected. Skipping payment sync.');
      return null;
    }

    const qboCustomerId = await ensureCustomerInQuickBooks(customerId);
    const paymentMethodId = await getCreditCardPaymentMethodId();
    const serviceItemId = await getDefaultServiceItemId();

    const amountInDollars = amount / 100;
    const paymentDateStr = paymentDate || new Date().toISOString().split('T')[0];
    const note = `Stripe Payment Intent: ${stripePaymentIntentId}${description ? ` - ${description}` : ''}`;

    // SalesReceipt is the correct entity for payment received without invoice
    const salesReceiptPayload = {
      CustomerRef: { value: qboCustomerId },
      PaymentMethodRef: { value: paymentMethodId, name: 'Credit Card' },
      TxnDate: paymentDateStr,
      TotalAmt: amountInDollars,
      PrivateNote: note,
      Line: [
        {
          DetailType: 'SalesItemLineDetail',
          Amount: amountInDollars,
          SalesItemLineDetail: {
            ItemRef: { value: serviceItemId },
            UnitPrice: amountInDollars,
            Qty: 1
          },
          Description: description || 'Contract payment'
        }
      ]
    };

    console.log('📤 Creating SalesReceipt in QuickBooks:', JSON.stringify(salesReceiptPayload, null, 2));

    const response = await qboRequest<{ SalesReceipt: { Id: string } }>(
      '/salesreceipt?minorversion=65',
      {
        method: 'POST',
        body: JSON.stringify(salesReceiptPayload)
      }
    );

    const qboPaymentId = response.SalesReceipt?.Id;

    if (qboPaymentId) {
      console.log(`✅ Payment recorded in QuickBooks: ${qboPaymentId}`);
      return qboPaymentId;
    } else {
      console.error('❌ QuickBooks payment creation returned no ID');
      return null;
    }
  } catch (error: any) {
    // Fail gracefully - log error but don't throw
    // This ensures payment processing in Stripe is not blocked
    console.error('❌ Error recording payment in QuickBooks:', error);
    console.error('Error details:', {
      message: error.message,
      customerId,
      amount,
      stripePaymentIntentId
    });
    return null;
  }
}

/**
 * Get a default Service item ID for SalesReceipt line items.
 * Creates "Labor Support" service item if none exists.
 */
async function getDefaultServiceItemId(): Promise<string> {
  try {
    const query = encodeURIComponent(
      "SELECT * FROM Item WHERE Type = 'Service' AND Active = true MAXRESULTS 1"
    );
    const response = await qboRequest<{
      QueryResponse?: { Item?: Array<{ Id: string; Name: string }> };
    }>(`/query?query=${query}&minorversion=65`);

    const items = response.QueryResponse?.Item;
    if (items && items.length > 0) {
      console.log(`✅ Using Service item for SalesReceipt: ${items[0].Name} (${items[0].Id})`);
      return items[0].Id;
    }

    // Fallback: try any Item
    const fallbackQuery = encodeURIComponent('SELECT * FROM Item WHERE Active = true MAXRESULTS 1');
    const fallback = await qboRequest<{
      QueryResponse?: { Item?: Array<{ Id: string; Name: string }> };
    }>(`/query?query=${fallbackQuery}&minorversion=65`);
    const fallbackItems = fallback.QueryResponse?.Item;
    if (fallbackItems && fallbackItems.length > 0) {
      console.log(`✅ Using fallback Item for SalesReceipt: ${fallbackItems[0].Name} (${fallbackItems[0].Id})`);
      return fallbackItems[0].Id;
    }

    // No items exist — create default "Labor Support" service item
    return await createServiceItem();
  } catch (error) {
    console.warn('⚠️ Could not query items:', error);
    try {
      return await createServiceItem();
    } catch (createErr) {
      throw new Error(
        'No QuickBooks item found and could not create one. Ensure QuickBooks is connected.'
      );
    }
  }
}

/**
 * Create a default "Labor Support" Service item in QuickBooks.
 */
async function createServiceItem(): Promise<string> {
  try {
    const incomeAccountRef = await getIncomeAccountRef();
    const itemPayload = {
      Name: 'Labor Support',
      Type: 'Service',
      Description: 'Doula labor support services',
      IncomeAccountRef: incomeAccountRef,
      Taxable: false
    };

    console.log('📤 Creating Labor Support service item in QuickBooks...');
    const response = await qboRequest<{ Item: { Id: string; Name: string } }>(
      '/item?minorversion=65',
      { method: 'POST', body: JSON.stringify(itemPayload) }
    );

    if (response.Item?.Id) {
      console.log(`✅ Created Labor Support service item: ${response.Item.Id}`);
      return response.Item.Id;
    }
  } catch (err: any) {
    if (err?.message?.includes('Duplicate') || err?.message?.includes('already exists')) {
      const existingQuery = encodeURIComponent("SELECT * FROM Item WHERE Name = 'Labor Support' MAXRESULTS 1");
      const existing = await qboRequest<{
        QueryResponse?: { Item?: Array<{ Id: string }> };
      }>(`/query?query=${existingQuery}&minorversion=65`);
      if (existing.QueryResponse?.Item?.length) {
        return existing.QueryResponse.Item[0].Id;
      }
    }
    throw err;
  }
  throw new Error('Failed to create QuickBooks service item');
}

/**
 * Get an income account reference (Sales, Services, etc.) for the service item.
 */
async function getIncomeAccountRef(): Promise<{ value: string; name?: string }> {
  const accountNames = ['Sales', 'Services', 'Sales of Product Income', 'Service Income', 'Income'];
  for (const name of accountNames) {
    try {
      const query = encodeURIComponent(
        `SELECT * FROM Account WHERE AccountType = 'Income' AND Active = true AND Name = '${name.replace(/'/g, "''")}' MAXRESULTS 1`
      );
      const response = await qboRequest<{
        QueryResponse?: { Account?: Array<{ Id: string; Name: string }> };
      }>(`/query?query=${query}&minorversion=65`);
      const accounts = response.QueryResponse?.Account;
      if (accounts && accounts.length > 0) {
        return { value: accounts[0].Id, name: accounts[0].Name };
      }
    } catch {
      continue;
    }
  }

  // Fallback: get any income account
  const fallbackQuery = encodeURIComponent(
    "SELECT * FROM Account WHERE AccountType = 'Income' AND Active = true MAXRESULTS 1"
  );
  const fallback = await qboRequest<{
    QueryResponse?: { Account?: Array<{ Id: string; Name: string }> };
  }>(`/query?query=${fallbackQuery}&minorversion=65`);
  const accounts = fallback.QueryResponse?.Account;
  if (accounts && accounts.length > 0) {
    return { value: accounts[0].Id, name: accounts[0].Name };
  }

  throw new Error(
    'No QuickBooks income account found. Create an Income account (e.g. "Sales" or "Services") in QuickBooks.'
  );
}

/**
 * Get the payment method ID for "Credit Card" in QuickBooks
 * Falls back to "1" if query fails (common default ID)
 */
async function getCreditCardPaymentMethodId(): Promise<string> {
  try {
    // Try to query for Credit Card payment method
    const query = encodeURIComponent("SELECT * FROM PaymentMethod WHERE Name = 'Credit Card'");
    const response = await qboRequest<{
      QueryResponse?: {
        PaymentMethod?: Array<{ Id: string; Name: string }>;
      };
    }>(`/query?query=${query}&minorversion=65`);

    const paymentMethods = response.QueryResponse?.PaymentMethod;
    if (paymentMethods && paymentMethods.length > 0) {
      console.log(`✅ Found Credit Card payment method: ${paymentMethods[0].Id}`);
      return paymentMethods[0].Id;
    }
  } catch (error) {
    console.warn('⚠️ Could not query payment methods, using default ID "1"');
  }

  // Default to "1" which is typically Credit Card in QuickBooks
  return '1';
}
