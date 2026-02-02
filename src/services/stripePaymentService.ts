import crypto from 'crypto';
import Stripe from 'stripe';
import supabase from '../supabase';
import { SimplePaymentService } from './simplePaymentService';
import { getStripe } from '../config/stripe';

export interface StripePaymentRequest {
  contract_id: string;
  payment_id: string;
  amount: number; // in cents
  currency?: string;
  customer_email?: string;
  customer_name?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface StripePaymentResult {
  payment_intent_id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
  customer_email?: string;
}

export interface PaymentIntentWebhookData {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  customer_email?: string;
  metadata?: Record<string, string>;
  receipt_email?: string;
  payment_method?: string;
}

export class StripePaymentService {
  private paymentService: SimplePaymentService;
  private stripe: Stripe;

  constructor() {
    this.paymentService = new SimplePaymentService();
    this.stripe = getStripe();
  }

  /**
   * Create a Stripe payment intent for a contract payment
   */
  async createPaymentIntent(request: StripePaymentRequest): Promise<StripePaymentResult> {
    console.log('💳 Creating Stripe payment intent for contract:', request.contract_id);

    try {
      // Get contract and client information
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select(`
          *,
          client_info!inner(*)
        `)
        .eq('id', request.contract_id)
        .single();

      if (contractError || !contractData) {
        throw new Error(`Contract not found: ${request.contract_id}`);
      }

      // Get the specific payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_installments')
        .select(`
          *,
          payment_schedules!inner(contract_id)
        `)
        .eq('id', request.payment_id)
        .eq('payment_schedules.contract_id', request.contract_id)
        .single();

      if (paymentError || !paymentData) {
        throw new Error(`Payment record not found: ${request.payment_id}`);
      }

      // Create or get Stripe customer
      let customerId = await this.getOrCreateStripeCustomer({
        email: contractData.client_info?.email || 'client@example.com',
        name: `${contractData.client_info?.first_name || ''} ${contractData.client_info?.last_name || ''}`.trim() || 'Client',
        metadata: {
          contract_id: request.contract_id,
          client_id: contractData.client_id
        }
      });

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount, // Amount in cents
        currency: request.currency || 'usd',
        customer: customerId,
        receipt_email: contractData.client_info?.email || 'client@example.com',
        description: request.description || `Payment for ${contractData.template_title || 'Contract'}`,
        metadata: {
          contract_id: request.contract_id,
          payment_id: request.payment_id,
          payment_type: paymentData.payment_type || 'installment',
          ...request.metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      console.log('✅ Stripe payment intent created:', paymentIntent.id);

      return {
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customer_email: contractData.client_email
      };

    } catch (error) {
      console.error('❌ Error creating Stripe payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Get or create a Stripe customer using existing customer system
   */
  private async getOrCreateStripeCustomer(customerData: {
    email: string;
    name: string;
    metadata: Record<string, string>;
  }): Promise<string> {
    try {
      // First, try to find existing customer in our database
      const { data: existingCustomer, error: customerError } = await supabase
        .from('customers')
        .select('id, stripe_customer_id')
        .eq('email', customerData.email)
        .single();

      if (existingCustomer?.stripe_customer_id) {
        console.log('📧 Found existing customer with Stripe ID:', existingCustomer.stripe_customer_id);

        // Verify the customer still exists in Stripe
        try {
          await this.stripe.customers.retrieve(existingCustomer.stripe_customer_id);
          return existingCustomer.stripe_customer_id;
        } catch (stripeError) {
          console.log('⚠️ Stripe customer not found, creating new one');
          // Continue to create new customer
        }
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        metadata: customerData.metadata,
      });

      console.log('✅ Created new Stripe customer:', customer.id);

      // Save to our customers table if not exists
      if (!existingCustomer) {
        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            id: crypto.randomUUID(),
            email: customerData.email,
            name: customerData.name,
            stripe_customer_id: customer.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('⚠️ Failed to save customer to database:', insertError);
        }
      } else {
        // Update existing customer with Stripe ID
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            stripe_customer_id: customer.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCustomer.id);

        if (updateError) {
          console.error('⚠️ Failed to update customer with Stripe ID:', updateError);
        }
      }

      return customer.id;

    } catch (error) {
      console.error('❌ Error managing Stripe customer:', error);
      throw new Error(`Failed to manage customer: ${error.message}`);
    }
  }

  /**
   * Update payment installment status
   */
  private async updatePaymentInstallmentStatus(
    paymentId: string,
    status: string,
    stripePaymentIntentId: string,
    notes: string
  ): Promise<void> {
    try {
      console.log(`📝 Updating payment installment ${paymentId} to ${status}`);

      const { data, error } = await supabase
        .from('payment_installments')
        .update({
          status: status,
          stripe_payment_intent_id: stripePaymentIntentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating payment installment status:', error);
        throw new Error(`Failed to update payment installment status: ${error.message}`);
      }

      console.log('✅ Payment installment status updated successfully');
    } catch (error) {
      console.error('❌ Error in updatePaymentInstallmentStatus:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook for payment confirmation
   */
  async handlePaymentWebhook(event: Stripe.Event): Promise<void> {
    console.log('🔔 Processing Stripe webhook:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as PaymentIntentWebhookData);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as PaymentIntentWebhookData);
        break;
      case 'payment_intent.canceled':
        await this.handlePaymentCancellation(event.data.object as PaymentIntentWebhookData);
        break;
      default:
        console.log('ℹ️ Unhandled webhook event type:', event.type);
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: PaymentIntentWebhookData): Promise<void> {
    console.log('✅ Payment succeeded:', paymentIntent.id);

    try {
      const contractId = paymentIntent.metadata?.contract_id;
      const paymentId = paymentIntent.metadata?.payment_id;

      if (!contractId || !paymentId) {
        console.error('❌ Missing contract_id or payment_id in payment intent metadata');
        return;
      }

      // Update payment status in payment installments database
      await this.updatePaymentInstallmentStatus(
        paymentId,
        'succeeded',
        paymentIntent.id,
        `Payment processed successfully via Stripe. Amount: $${(paymentIntent.amount / 100).toFixed(2)}`
      );

      // Save to existing charges table for compatibility
      await this.saveToChargesTable(paymentIntent);

      // Update contract status if this was the final payment
      await this.checkAndUpdateContractStatus(contractId);

      console.log('✅ Payment status updated successfully');

    } catch (error) {
      console.error('❌ Error handling payment success:', error);
    }
  }

  /**
   * Save payment to existing charges table for compatibility
   */
  private async saveToChargesTable(paymentIntent: PaymentIntentWebhookData): Promise<void> {
    try {
      const contractId = paymentIntent.metadata?.contract_id;

      if (!contractId) {
        console.log('⚠️ No contract_id in metadata, skipping charges table save');
        return;
      }

      // Get customer ID from contract
      const { data: contractData, error: contractError } = await supabase
        .from('contracts_with_clients')
        .select('client_id')
        .eq('contract_id', contractId)
        .single();

      if (contractError || !contractData) {
        console.error('❌ Could not find contract for charges table save:', contractError);
        return;
      }

      // Find or create customer record
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', paymentIntent.customer_email || paymentIntent.receipt_email)
        .single();

      if (customerError || !customerData) {
        console.log('⚠️ Customer not found in charges table, skipping save');
        return;
      }

      // Save to charges table (using a dummy payment method ID since we don't have one in the contract system)
      const { data: chargeData, error: chargesError } = await supabase
        .from('charges')
        .insert({
          customer_id: customerData.id,
          payment_method_id: customerData.id, // Using customer ID as placeholder
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          status: paymentIntent.status,
          description: `Contract payment - ${paymentIntent.metadata?.payment_type || 'unknown'}`,
          qb_sync_status: 'pending', // Mark as pending sync
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (chargesError) {
        console.error('⚠️ Failed to save to charges table:', chargesError);
      } else {
        console.log('✅ Payment saved to charges table');

        // Sync to QuickBooks (non-blocking)
        if (chargeData?.id) {
          const syncPaymentToQuickBooks = (await import('./payments/syncPaymentToQuickBooks')).default;
          syncPaymentToQuickBooks(
            chargeData.id,
            customerData.id,
            paymentIntent.amount,
            paymentIntent.id,
            `Contract payment - ${paymentIntent.metadata?.payment_type || 'unknown'}`
          ).catch(err => {
            console.error('❌ QuickBooks sync failed (non-blocking):', err);
          });
        }
      }

    } catch (error) {
      console.error('❌ Error saving to charges table:', error);
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(paymentIntent: PaymentIntentWebhookData): Promise<void> {
    console.log('❌ Payment failed:', paymentIntent.id);

    try {
      const paymentId = paymentIntent.metadata?.payment_id;

      if (!paymentId) {
        console.error('❌ Missing payment_id in payment intent metadata');
        return;
      }

      await this.paymentService.updatePaymentStatus(
        paymentId,
        'failed',
        paymentIntent.id,
        'Payment failed via Stripe'
      );

      console.log('✅ Payment failure status updated');

    } catch (error) {
      console.error('❌ Error handling payment failure:', error);
    }
  }

  /**
   * Handle payment cancellation
   */
  private async handlePaymentCancellation(paymentIntent: PaymentIntentWebhookData): Promise<void> {
    console.log('🚫 Payment canceled:', paymentIntent.id);

    try {
      const paymentId = paymentIntent.metadata?.payment_id;

      if (!paymentId) {
        console.error('❌ Missing payment_id in payment intent metadata');
        return;
      }

      await this.paymentService.updatePaymentStatus(
        paymentId,
        'canceled',
        paymentIntent.id,
        'Payment canceled by user'
      );

      console.log('✅ Payment cancellation status updated');

    } catch (error) {
      console.error('❌ Error handling payment cancellation:', error);
    }
  }

  /**
   * Check if contract should be marked as completed
   */
  private async checkAndUpdateContractStatus(contractId: string): Promise<void> {
    try {
      const summary = await this.paymentService.getPaymentSummary(contractId);

      // If all payments are succeeded, update contract status
      if (summary.total_due === 0 && summary.total_paid > 0) {
        const { error } = await supabase
          .from('contracts')
          .update({
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', contractId);

        if (error) {
          console.error('❌ Error updating contract status:', error);
        } else {
          console.log('✅ Contract status updated to active');
        }
      }

    } catch (error) {
      console.error('❌ Error checking contract status:', error);
    }
  }

  /**
   * Get next payment for a contract
   */
  async getNextPayment(contractId: string): Promise<any> {
    console.log('📅 Getting next payment for contract:', contractId);

    try {
      const { data, error } = await supabase
        .from('payment_installments')
        .select(`
          *,
          payment_schedules!inner(contract_id)
        `)
        .eq('payment_schedules.contract_id', contractId)
        .in('status', ['pending', 'failed'])
        .order('due_date', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No pending payments
        }
        throw error;
      }

      return data;

    } catch (error) {
      console.error('❌ Error getting next payment:', error);
      throw new Error(`Failed to get next payment: ${error.message}`);
    }
  }

  /**
   * Create payment intent for the next due payment
   */
  async createNextPaymentIntent(contractId: string): Promise<StripePaymentResult | null> {
    console.log('💳 Creating payment intent for next payment:', contractId);

    try {
      const nextPayment = await this.getNextPayment(contractId);

      if (!nextPayment) {
        console.log('ℹ️ No pending payments for contract');
        return null;
      }

      return await this.createPaymentIntent({
        contract_id: contractId,
        payment_id: nextPayment.id,
        amount: Math.round(nextPayment.amount * 100), // Convert to cents
        description: `${nextPayment.payment_type} payment for contract`
      });

    } catch (error) {
      console.error('❌ Error creating next payment intent:', error);
      throw new Error(`Failed to create next payment intent: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature (security)
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}
