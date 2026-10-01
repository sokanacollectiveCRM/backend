import createPaymentInQuickBooks from './createPaymentInQuickBooks';

/**
 * Sync a payment to QuickBooks after it's been recorded in the database.
 * This is a non-blocking operation - failures are logged but don't throw errors.
 *
 * @param chargeId The ID of the charge record in the database
 * @param customerId The internal customer ID
 * @param amount Payment amount in cents
 * @param stripePaymentIntentId Stripe payment intent ID
 * @param description Optional payment description
 */
export default async function syncPaymentToQuickBooks(
  chargeId: string,
  customerId: string,
  amount: number,
  stripePaymentIntentId: string,
  description?: string
): Promise<void> {
  try {
    console.log(
      `🔄 Syncing payment to QuickBooks: charge ${chargeId}, customer ${customerId}`
    );

    const qboPaymentId = await createPaymentInQuickBooks({
      customerId,
      amount,
      stripePaymentIntentId,
      description,
      paymentDate: new Date().toISOString().split('T')[0],
    });

    if (qboPaymentId) {
      console.log(`✅ Payment synced to QuickBooks: ${qboPaymentId}`);
    } else {
      console.error('⚠️ QuickBooks sync returned no payment ID');
    }
  } catch (error: unknown) {
    console.error('❌ Error syncing payment to QuickBooks:', error);
  }
}
