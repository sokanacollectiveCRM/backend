import createPaymentInQuickBooks, { PaymentData } from './createPaymentInQuickBooks';
import supabase from '../../supabase';

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
    console.log(`🔄 Syncing payment to QuickBooks: charge ${chargeId}, customer ${customerId}`);

    // Record payment in QuickBooks
    const qboPaymentId = await createPaymentInQuickBooks({
      customerId,
      amount,
      stripePaymentIntentId,
      description,
      paymentDate: new Date().toISOString().split('T')[0]
    });

    // Update charge record with QuickBooks sync status
    if (qboPaymentId) {
      const { error: updateError } = await supabase
        .from('charges')
        .update({
          qbo_payment_id: qboPaymentId,
          qb_sync_status: 'synced',
          qb_sync_error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', chargeId);

      if (updateError) {
        console.error('⚠️ Failed to update charge with QuickBooks payment ID:', updateError);
      } else {
        console.log(`✅ Payment synced to QuickBooks: ${qboPaymentId}`);
      }
    } else {
      // Sync failed but didn't throw - mark as failed
      const { error: updateError } = await supabase
        .from('charges')
        .update({
          qb_sync_status: 'failed',
          qb_sync_error: 'QuickBooks sync returned no payment ID',
          updated_at: new Date().toISOString()
        })
        .eq('id', chargeId);

      if (updateError) {
        console.error('⚠️ Failed to update charge sync status:', updateError);
      }
    }
  } catch (error: any) {
    // Log error but don't throw - payment processing should continue
    console.error('❌ Error syncing payment to QuickBooks:', error);

    // Update charge record with error status
    try {
      await supabase
        .from('charges')
        .update({
          qb_sync_status: 'failed',
          qb_sync_error: error.message || 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', chargeId);
    } catch (updateError) {
      console.error('⚠️ Failed to update charge with error status:', updateError);
    }
  }
}
