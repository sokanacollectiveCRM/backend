import { stripe } from '../../config/stripe';
import supabase from '../../supabase';

interface SaveCardParams {
  customerId: string;
  cardToken: string;
}

interface ChargeCardParams {
  customerId: string;
  amount: number; // Amount in cents
  description?: string;
}

interface UpdateCardParams {
  customerId: string;
  cardToken: string;
  paymentMethodId: string;
}

export class StripePaymentService {
  private async ensureStripeCustomer(customerId: string): Promise<string> {
    console.log(`Ensuring Stripe customer exists for customer ID: ${customerId}`);
    
    // Get customer info from database
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('email, name, stripe_customer_id')
      .eq('id', customerId)
      .single();

    if (customerError || !customerData) {
      console.error('Customer lookup error:', customerError);
      throw new Error(`Customer not found: ${customerError?.message}`);
    }

    console.log('Found customer data:', { 
      email: customerData.email, 
      name: customerData.name, 
      hasStripeId: !!customerData.stripe_customer_id 
    });

    // If customer already has Stripe ID, verify it exists in Stripe
    if (customerData.stripe_customer_id) {
      try {
        await stripe.customers.retrieve(customerData.stripe_customer_id);
        console.log('Verified existing Stripe customer:', customerData.stripe_customer_id);
        return customerData.stripe_customer_id;
      } catch (err) {
        console.log('Stripe customer ID exists in DB but not in Stripe, creating new one');
        // Continue to create new customer if retrieval fails
      }
    }

    // Create new Stripe customer
    try {
      const stripeCustomer = await stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        metadata: {
          supabase_customer_id: customerId
        }
      });
      
      console.log('Created new Stripe customer:', stripeCustomer.id);

      // Save Stripe customer ID
      const { error: updateError } = await supabase
        .from('customers')
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq('id', customerId);

      if (updateError) {
        console.error('Failed to save Stripe customer ID:', updateError);
        throw new Error(`Failed to save Stripe customer ID: ${updateError.message}`);
      }

      console.log('Successfully saved Stripe customer ID to database');
      return stripeCustomer.id;
    } catch (err) {
      console.error('Error creating Stripe customer:', err);
      throw new Error(`Failed to create Stripe customer: ${err.message}`);
    }
  }

  async saveCard({ customerId, cardToken }: SaveCardParams) {
    console.log('Starting saveCard process for customer:', customerId);
    
    // Ensure customer exists in Stripe
    const stripeCustomerId = await this.ensureStripeCustomer(customerId);
    
    try {
      // First, mark any existing payment methods as not default
      console.log('Marking existing payment methods as not default');
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('customer_id', customerId);

      // Create a payment method from the token and attach to customer in one step
      console.log('Creating payment method from token and attaching to customer');
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token: cardToken },
        metadata: {
          customer_id: customerId
        }
      });

      console.log('Created payment method:', paymentMethod.id);

      // Attach payment method to the customer
      console.log('Attaching payment method to customer');
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: stripeCustomerId,
      });

      // Set as default payment method
      console.log('Setting as default payment method');
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      // Store the payment method in our database
      console.log('Saving payment method to database');
      const paymentMethodData = {
        customer_id: customerId,
        stripe_payment_method_id: paymentMethod.id,
        card_last4: paymentMethod.card!.last4,
        card_brand: paymentMethod.card!.brand,
        card_exp_month: paymentMethod.card!.exp_month,
        card_exp_year: paymentMethod.card!.exp_year,
        is_default: true
      };
      
      console.log('Payment method data to insert:', paymentMethodData);
      
      const { data: insertResult, error } = await supabase
        .from('payment_methods')
        .insert(paymentMethodData)
        .select();

      console.log('Insert result:', insertResult);
      console.log('Insert error:', error);

      if (error) {
        console.error('Database error saving payment method:', error);
        throw new Error(`Failed to save payment method: ${error.message}`);
      }

      console.log('Successfully saved card');
      return {
        id: paymentMethod.id,
        last4: paymentMethod.card!.last4,
        brand: paymentMethod.card!.brand,
        expMonth: paymentMethod.card!.exp_month,
        expYear: paymentMethod.card!.exp_year
      };
    } catch (err) {
      console.error('Error in saveCard:', err);
      throw err;
    }
  }

  async chargeCard({ customerId, amount, description }: ChargeCardParams) {
    console.log('Starting charge process for customer:', customerId);
    
    // Ensure customer exists in Stripe
    const stripeCustomerId = await this.ensureStripeCustomer(customerId);

    // Debug: Check all payment methods for this customer
    console.log('Checking all payment methods for customer:', customerId);
    const { data: allPaymentMethods, error: allError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('customer_id', customerId);
    
    console.log('All payment methods for customer:', allPaymentMethods);
    console.log('Payment methods query error:', allError);

    // Get the payment method
    console.log('Fetching default payment method');
    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .select('id, stripe_payment_method_id')
      .eq('customer_id', customerId)
      .eq('is_default', true)
      .single();

    console.log('Default payment method query result:', paymentMethod);
    console.log('Default payment method query error:', error);

    if (error || !paymentMethod) {
      console.error('Payment method lookup error:', error);
      throw new Error('No payment method found for this customer');
    }

    try {
      // Create and confirm the payment intent
      console.log('Creating payment intent');
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: paymentMethod.stripe_payment_method_id,
        confirm: true,
        description,
        off_session: true
      });

      console.log('Payment intent created:', paymentIntent.id);

      // Save the charge
      console.log('Saving charge to database');
      const { error: chargeError } = await supabase.from('charges').insert({
        customer_id: customerId,
        payment_method_id: paymentMethod.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
        description: paymentIntent.description
      });

      if (chargeError) {
        console.error('Failed to save charge to database:', chargeError);
      }

      console.log('Charge process completed successfully');
      return paymentIntent;
    } catch (err) {
      console.error('Error in chargeCard:', err);
      throw err;
    }
  }

  async updateCard({ customerId, cardToken, paymentMethodId }: UpdateCardParams) {
    console.log('Starting updateCard process for customer:', customerId);
    
    // Ensure customer exists in Stripe
    const stripeCustomerId = await this.ensureStripeCustomer(customerId);

    try {
      // Verify the payment method belongs to this customer
      const { data: existingPaymentMethod, error: lookupError } = await supabase
        .from('payment_methods')
        .select('stripe_payment_method_id, is_default')
        .eq('id', paymentMethodId)
        .eq('customer_id', customerId)
        .single();

      if (lookupError || !existingPaymentMethod) {
        throw new Error('Payment method not found or does not belong to this customer');
      }

      // Create new payment method from token
      console.log('Creating new payment method from token');
      const newPaymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token: cardToken }
      });

      console.log('Created new payment method:', newPaymentMethod.id);

      // Attach new payment method to customer
      console.log('Attaching new payment method to customer');
      await stripe.paymentMethods.attach(newPaymentMethod.id, {
        customer: stripeCustomerId,
      });

      // If this was the default payment method, update customer's default
      if (existingPaymentMethod.is_default) {
        console.log('Updating default payment method');
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: newPaymentMethod.id,
          },
        });
      }

      // Detach old payment method from Stripe
      console.log('Detaching old payment method');
      await stripe.paymentMethods.detach(existingPaymentMethod.stripe_payment_method_id);

      // Update payment method in database
      console.log('Updating payment method in database');
      const { error: updateError } = await supabase
        .from('payment_methods')
        .update({
          stripe_payment_method_id: newPaymentMethod.id,
          card_last4: newPaymentMethod.card!.last4,
          card_brand: newPaymentMethod.card!.brand,
          card_exp_month: newPaymentMethod.card!.exp_month,
          card_exp_year: newPaymentMethod.card!.exp_year,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentMethodId)
        .eq('customer_id', customerId);

      if (updateError) {
        console.error('Database error updating payment method:', updateError);
        throw new Error(`Failed to update payment method: ${updateError.message}`);
      }

      console.log('Successfully updated card');
      return {
        id: newPaymentMethod.id,
        last4: newPaymentMethod.card!.last4,
        brand: newPaymentMethod.card!.brand,
        expMonth: newPaymentMethod.card!.exp_month,
        expYear: newPaymentMethod.card!.exp_year
      };
    } catch (err) {
      console.error('Error in updateCard:', err);
      throw err;
    }
  }

  async getPaymentMethods(customerId: string) {
    console.log('Fetching payment methods for customer:', customerId);
    
    try {
      // Get payment methods from database
      const { data: paymentMethods, error } = await supabase
        .from('payment_methods')
        .select('id, stripe_payment_method_id, card_last4, card_brand, card_exp_month, card_exp_year, is_default, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error fetching payment methods:', error);
        throw new Error(`Failed to fetch payment methods: ${error.message}`);
      }

      console.log(`Found ${paymentMethods?.length || 0} payment methods for customer`);
      
      return (paymentMethods || []).map(pm => ({
        id: pm.id,
        stripePaymentMethodId: pm.stripe_payment_method_id,
        last4: pm.card_last4,
        brand: pm.card_brand,
        expMonth: pm.card_exp_month,
        expYear: pm.card_exp_year,
        isDefault: pm.is_default,
        createdAt: pm.created_at
      }));
    } catch (err) {
      console.error('Error in getPaymentMethods:', err);
      throw err;
    }
  }

  async getCustomersWithStripeId() {
    console.log('Fetching customers with Stripe IDs');
    
    try {
      // Get customers from database that have a stripe_customer_id
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, email, stripe_customer_id, created_at, updated_at')
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error fetching customers:', error);
        throw new Error(`Failed to fetch customers: ${error.message}`);
      }

      console.log(`Found ${customers?.length || 0} customers with Stripe IDs`);
      
      return (customers || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        stripeCustomerId: customer.stripe_customer_id,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      }));
    } catch (err) {
      console.error('Error in getCustomersWithStripeId:', err);
      throw err;
    }
  }
} 