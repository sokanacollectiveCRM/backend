import express, { Request, Response } from 'express';
import { stripe } from '../config/stripe';
import { ContractClientService } from '../services/contractClientService';
import { StripePaymentService } from '../services/stripePaymentService';
import supabase from '../supabase';

const router = express.Router();
const stripeService = new StripePaymentService();
const contractService = new ContractClientService();

// Create payment intent for next payment after contract signing
router.post('/contract/:contractId/create-payment', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;

    console.log('💳 Creating payment intent for contract after signing:', contractId);

    // Verify contract is signed
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    if (contract.status !== 'signed') {
      return res.status(400).json({
        success: false,
        error: 'Contract must be signed before processing payment'
      });
    }

    // Create payment intent for next payment
    const paymentResult = await stripeService.createNextPaymentIntent(contractId);

    if (!paymentResult) {
      return res.status(400).json({
        success: false,
        error: 'No pending payments found for this contract'
      });
    }

    res.json({
      success: true,
      data: {
        payment_intent_id: paymentResult.payment_intent_id,
        client_secret: paymentResult.client_secret,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: paymentResult.status
      }
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create payment intent for specific payment
router.post('/contract/:contractId/payment/:paymentId/create', async (req: Request, res: Response) => {
  try {
    const { contractId, paymentId } = req.params;
    const { amount, description, metadata } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, error: 'Amount is required' });
    }

    const paymentResult = await stripeService.createPaymentIntent({
      contract_id: contractId,
      payment_id: paymentId,
      amount: Math.round(amount * 100), // Convert dollars to cents
      description,
      metadata
    });

    res.json({
      success: true,
      data: {
        payment_intent_id: paymentResult.payment_intent_id,
        client_secret: paymentResult.client_secret,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: paymentResult.status
      }
    });

  } catch (error) {
    console.error('Error creating specific payment intent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle Stripe webhook
router.post('/webhook', express.raw({type: 'application/json'}), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ success: false, error: 'Webhook secret not configured' });
    }

    // Ensure body is a Buffer for signature verification
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    
    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(body, signature, webhookSecret);

    // Handle the webhook event
    await stripeService.handlePaymentWebhook(event);

    res.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get payment status
router.get('/payment-intent/:paymentIntentId/status', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    res.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata
      }
    });

  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get next payment for contract
router.get('/contract/:contractId/next-payment', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;

    const nextPayment = await stripeService.getNextPayment(contractId);

    if (!nextPayment) {
      return res.json({ success: true, data: null, message: 'No pending payments' });
    }

    res.json({ success: true, data: nextPayment });

  } catch (error) {
    console.error('Error getting next payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payment summary for contract
router.get('/contract/:contractId/payment-summary', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;

    const summary = await contractService.getContractPaymentSummary(contractId);

    res.json({ success: true, data: summary });

  } catch (error) {
    console.error('Error getting payment summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm payment completion (for frontend)
router.post('/payment-intent/:paymentIntentId/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Payment is already confirmed via webhook, just return success
      res.json({
        success: true,
        data: {
          status: 'succeeded',
          message: 'Payment completed successfully'
        }
      });
    } else if (paymentIntent.status === 'requires_payment_method') {
      // Payment failed, needs new payment method
      res.json({
        success: false,
        data: {
          status: 'failed',
          message: 'Payment method declined or failed'
        }
      });
    } else {
      // Payment is still processing
      res.json({
        success: true,
        data: {
          status: paymentIntent.status,
          message: 'Payment is still processing'
        }
      });
    }

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
