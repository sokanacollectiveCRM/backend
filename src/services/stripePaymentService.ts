import crypto from 'crypto';
import Stripe from 'stripe';
import supabase from '../supabase';
import { getPool } from '../db/cloudSqlPool';
import { insertPaymentToCloudSql } from '../repositories/cloudSqlPaymentRepository';
import createPaymentInQuickBooks from './payments/createPaymentInQuickBooks';
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
   * Create a Stripe payment intent for a contract payment.
   * Tries phi_contracts (Cloud SQL) first, then Supabase contracts.
   */
  async createPaymentIntent(request: StripePaymentRequest): Promise<StripePaymentResult> {
    console.log('💳 Creating Stripe payment intent for contract:', request.contract_id);

    try {
      // Try phi_contracts (Cloud SQL) first — Labor Support flow
      const pool = getPool();
      const { rows: phiRows } = await pool.query<{ client_id: string }>(
        'SELECT client_id FROM phi_contracts WHERE id = $1 LIMIT 1',
        [request.contract_id]
      );
      if (phiRows.length > 0) {
        const clientId = phiRows[0].client_id;
        const { rows: clientRows } = await pool.query<{ first_name: string; last_name: string; email: string }>(
          'SELECT first_name, last_name, email FROM phi_clients WHERE id = $1 LIMIT 1',
          [clientId]
        );
        const client = clientRows[0];
        if (!client) throw new Error(`Client not found: ${clientId}`);

        const { rows: instRows } = await pool.query<{ payment_type: string }>(
          `SELECT pi.payment_type FROM payment_installments pi
           JOIN payment_schedules ps ON ps.id = pi.schedule_id
           WHERE ps.contract_id = $1 AND pi.id = $2 AND pi.status IN ('pending', 'failed')`,
          [request.contract_id, request.payment_id]
        );
        if (instRows.length === 0) {
          throw new Error(`Payment record not found: ${request.payment_id}`);
        }

        const customerId = await this.getOrCreateStripeCustomer({
          email: client.email || 'client@example.com',
          name: [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || 'Client',
          metadata: { contract_id: request.contract_id, client_id: clientId }
        });

        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: request.amount,
          currency: request.currency || 'usd',
          customer: customerId,
          receipt_email: client.email || 'client@example.com',
          description: request.description || `Payment for Labor Support Contract`,
          metadata: {
            contract_id: request.contract_id,
            payment_id: request.payment_id,
            payment_type: instRows[0].payment_type || 'installment',
            ...request.metadata
          },
          automatic_payment_methods: { enabled: true },
        });

        console.log('✅ Stripe payment intent created (phi_contracts):', paymentIntent.id);
        return {
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret!,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          customer_email: client.email
        };
      }

      // Fall back to Supabase contracts
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select(`*, client_info!inner(*)`)
        .eq('id', request.contract_id)
        .single();

      if (contractError || !contractData) {
        throw new Error(`Contract not found: ${request.contract_id}`);
      }

      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_installments')
        .select(`*, payment_schedules!inner(contract_id)`)
        .eq('id', request.payment_id)
        .eq('payment_schedules.contract_id', request.contract_id)
        .single();

      if (paymentError || !paymentData) {
        throw new Error(`Payment record not found: ${request.payment_id}`);
      }

      const customerId = await this.getOrCreateStripeCustomer({
        email: contractData.client_info?.email || 'client@example.com',
        name: `${contractData.client_info?.first_name || ''} ${contractData.client_info?.last_name || ''}`.trim() || 'Client',
        metadata: { contract_id: request.contract_id, client_id: contractData.client_id }
      });

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
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
        automatic_payment_methods: { enabled: true },
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
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get or create a Stripe customer. Tries phi_clients first when client_id in metadata.
   */
  private async getOrCreateStripeCustomer(customerData: {
    email: string;
    name: string;
    metadata: Record<string, string>;
  }): Promise<string> {
    try {
      const clientId = customerData.metadata?.client_id;
      const pool = getPool();

      // For Labor Support: try phi_clients first
      if (clientId) {
        const { rows } = await pool.query<{ stripe_customer_id: string | null }>(
          'SELECT stripe_customer_id FROM phi_clients WHERE id = $1 LIMIT 1',
          [clientId]
        );
        if (rows[0]?.stripe_customer_id) {
          try {
            await this.stripe.customers.retrieve(rows[0].stripe_customer_id);
            console.log('📧 Found existing Stripe customer in phi_clients:', rows[0].stripe_customer_id);
            return rows[0].stripe_customer_id;
          } catch {
            /* Stripe customer gone, create new one */
          }
        }
      }

      // Try Cloud SQL customers (by email)
      const { rows: custRows } = await pool.query<{ id: string; stripe_customer_id: string | null }>(
        'SELECT id, stripe_customer_id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [customerData.email]
      );
      const existingCustomer = custRows[0];

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

      // Save to phi_clients when client_id present (Labor Support)
      let savedToPhi = false;
      if (clientId) {
        try {
          await pool.query(
            'UPDATE phi_clients SET stripe_customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [customer.id, clientId]
          );
          console.log('✅ Saved Stripe customer to phi_clients');
          savedToPhi = true;
        } catch (e) {
          console.warn('⚠️ Failed to save to phi_clients:', (e as Error).message);
        }
      }

      // Save to Cloud SQL customers (when phi_clients not used)
      if (!savedToPhi) {
        if (!existingCustomer) {
          await pool.query(
            `INSERT INTO customers (id, email, name, stripe_customer_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [crypto.randomUUID(), customerData.email, customerData.name, customer.id]
          );
          console.log('✅ Saved Stripe customer to Cloud SQL customers');
        } else {
          await pool.query(
            'UPDATE customers SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
            [customer.id, existingCustomer.id]
          );
          console.log('✅ Updated Stripe customer in Cloud SQL customers');
        }
      }

      return customer.id;

    } catch (error) {
      console.error('❌ Error managing Stripe customer:', error);
      throw new Error(`Failed to manage customer: ${error.message}`);
    }
  }

  /**
   * Update payment installment status (Cloud SQL or Supabase via SimplePaymentService)
   */
  private async updatePaymentInstallmentStatus(
    paymentId: string,
    status: string,
    stripePaymentIntentId: string,
    notes: string
  ): Promise<void> {
    await this.paymentService.updatePaymentStatus(paymentId, status as any, stripePaymentIntentId, notes);
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
   * Record payment success from payment intent ID.
   * Alternative to webhook - call from frontend after payment completes.
   * Fetches the payment intent from Stripe, verifies status, then updates DB + QuickBooks.
   */
  async recordPaymentSuccess(paymentIntentId: string): Promise<void> {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      throw new Error(`Payment intent ${paymentIntentId} has status ${pi.status}, expected succeeded`);
    }
    await this.processPaymentSuccess(pi as unknown as PaymentIntentWebhookData);
  }

  /**
   * Process a successful payment (shared by webhook and record-payment endpoint)
   */
  private async processPaymentSuccess(paymentIntent: PaymentIntentWebhookData): Promise<void> {
    console.log('✅ Payment succeeded:', paymentIntent.id);

    try {
      const contractId = paymentIntent.metadata?.contract_id;
      const paymentId = paymentIntent.metadata?.payment_id;

      if (!contractId || !paymentId) {
        console.error('❌ Missing contract_id or payment_id in payment intent metadata');
        return;
      }

      await this.updatePaymentInstallmentStatus(
        paymentId,
        'succeeded',
        paymentIntent.id,
        `Payment processed successfully via Stripe. Amount: $${(paymentIntent.amount / 100).toFixed(2)}`
      );

      // phi_contracts (Labor Support): insert Cloud SQL payments + QuickBooks
      const pool = getPool();
      const { rows: phiRows } = await pool.query<{ client_id: string }>(
        'SELECT client_id FROM phi_contracts WHERE id = $1 LIMIT 1',
        [contractId]
      );
      if (phiRows.length > 0) {
        const clientId = phiRows[0].client_id;
        const inserted = await insertPaymentToCloudSql({
          client_id: clientId,
          amount_cents: paymentIntent.amount,
          transaction_id: paymentIntent.id,
          description: `Contract payment - ${paymentIntent.metadata?.payment_type || 'unknown'}`
        });
        if (inserted != null) {
          // Update payments.contract_id if column exists
          try {
            await pool.query('UPDATE payments SET contract_id = $1 WHERE id = $2', [contractId, inserted]);
          } catch {
            // contract_id column may not exist
          }
        }
        console.log('📤 [QBO] Syncing Stripe payment to QuickBooks...', {
          clientId,
          amount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
          stripePaymentIntentId: paymentIntent.id,
          paymentType: paymentIntent.metadata?.payment_type
        });
        createPaymentInQuickBooks({
          customerId: clientId,
          amount: paymentIntent.amount,
          stripePaymentIntentId: paymentIntent.id,
          description: `Contract payment - ${paymentIntent.metadata?.payment_type || 'unknown'}`,
          paymentDate: new Date().toISOString().split('T')[0]
        })
          .then((qboId) => {
            if (qboId) {
              console.log('✅ [QBO] Payment recorded in QuickBooks:', { qboPaymentId: qboId, stripePaymentIntentId: paymentIntent.id });
            } else {
              console.warn('⚠️ [QBO] Sync completed but no QuickBooks payment ID returned (QB may not be connected).');
            }
          })
          .catch((err) => console.error('❌ [QBO] QuickBooks sync failed (non-blocking):', err instanceof Error ? err.message : err));
      } else {
        await this.saveToChargesTable(paymentIntent);
      }

      await this.checkAndUpdateContractStatus(contractId);

      console.log('✅ Payment status updated successfully');
    } catch (error) {
      console.error('❌ Error handling payment success:', error);
      throw error; // Re-throw so recordPaymentSuccess endpoint can return 500
    }
  }

  /**
   * Handle successful payment (webhook) - delegates to processPaymentSuccess.
   * Catches errors to avoid Stripe retries (we still return 200).
   */
  private async handlePaymentSuccess(paymentIntent: PaymentIntentWebhookData): Promise<void> {
    try {
      await this.processPaymentSuccess(paymentIntent);
    } catch (error) {
      console.error('❌ Error in handlePaymentSuccess:', error);
      // Don't rethrow - webhook returns 200 to avoid Stripe retries
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

      if (summary.total_due !== 0 || summary.total_paid <= 0) return;

      const pool = getPool();
      const { rowCount: phiUpdated } = await pool.query(
        "UPDATE phi_contracts SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [contractId]
      );
      if (phiUpdated && phiUpdated > 0) {
        console.log('✅ phi_contract status updated to active');
        return;
      }

      const { error } = await supabase
        .from('contracts')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', contractId);

      if (error) {
        console.error('❌ Error updating contract status:', error);
      } else {
        console.log('✅ Contract status updated to active');
      }
    } catch (error) {
      console.error('❌ Error checking contract status:', error);
    }
  }

  /**
   * Get next payment for a contract (Cloud SQL or Supabase)
   */
  async getNextPayment(contractId: string): Promise<any> {
    console.log('📅 Getting next payment for contract:', contractId);

    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT pi.* FROM payment_installments pi
         JOIN payment_schedules ps ON ps.id = pi.schedule_id
         WHERE ps.contract_id = $1 AND pi.status IN ('pending', 'failed')
         ORDER BY pi.due_date ASC NULLS LAST LIMIT 1`,
        [contractId]
      );
      if (rows.length > 0) {
        return rows[0];
      }

      const { data, error } = await supabase
        .from('payment_installments')
        .select(`*, payment_schedules!inner(contract_id)`)
        .eq('payment_schedules.contract_id', contractId)
        .in('status', ['pending', 'failed'])
        .order('due_date', { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    } catch (error) {
      console.error('❌ Error getting next payment:', error);
      throw new Error(`Failed to get next payment: ${error instanceof Error ? error.message : String(error)}`);
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
