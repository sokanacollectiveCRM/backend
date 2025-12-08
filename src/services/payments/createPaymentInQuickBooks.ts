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
 * This service handles:
 * - Ensuring customer exists in QuickBooks (existing or new)
 * - Recording payment with proper customer reference
 * - Error handling (fails gracefully, doesn't block payment processing)
 *
 * @param paymentData Payment information
 * @returns QuickBooks payment ID if successful, null if failed
 */
export default async function createPaymentInQuickBooks(
  paymentData: PaymentData
): Promise<string | null> {
  const { customerId, amount, stripePaymentIntentId, description, paymentDate } = paymentData;

  try {
    console.log(`💰 Recording payment in QuickBooks for customer: ${customerId}`);

    // Check if QuickBooks is connected
    const connected = await isConnected();
    if (!connected) {
      console.warn('⚠️ QuickBooks is not connected. Skipping payment sync.');
      return null;
    }

    // Ensure customer exists in QuickBooks (handles both existing and new customers)
    const qboCustomerId = await ensureCustomerInQuickBooks(customerId);

    // Get payment method ID for "Credit Card"
    // QuickBooks typically has "Credit Card" as payment method ID "1" or we can query for it
    const paymentMethodId = await getCreditCardPaymentMethodId();

    // Convert amount from cents to dollars
    const amountInDollars = amount / 100;

    // Use provided date or current date
    const paymentDateStr = paymentDate || new Date().toISOString().split('T')[0];

    // Build payment payload
    const paymentPayload = {
      CustomerRef: {
        value: qboCustomerId
      },
      TotalAmt: amountInDollars,
      PaymentMethodRef: {
        value: paymentMethodId,
        name: 'Credit Card'
      },
      TxnDate: paymentDateStr,
      PrivateNote: `Stripe Payment Intent: ${stripePaymentIntentId}${description ? ` - ${description}` : ''}`,
      Line: [
        {
          Amount: amountInDollars
        }
      ]
    };

    console.log('📤 Creating payment in QuickBooks:', JSON.stringify(paymentPayload, null, 2));

    // Create payment in QuickBooks
    const response = await qboRequest<{ Payment: { Id: string } }>(
      '/payment?minorversion=65',
      {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      }
    );

    const qboPaymentId = response.Payment?.Id;

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
