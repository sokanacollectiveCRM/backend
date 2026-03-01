import { Router, Request, Response } from 'express';
import { getPool } from '../db/cloudSqlPool';
import { ContractClientService } from '../services/contractClientService';
import { StripePaymentService } from '../services/stripePaymentService';
import supabase from '../supabase';

const router = Router();
let _contractService: ContractClientService | null = null;
let _stripeService: StripePaymentService | null = null;

function getContractService(): ContractClientService {
  if (!_contractService) _contractService = new ContractClientService();
  return _contractService;
}

function getStripeService(): StripePaymentService {
  if (!_stripeService) _stripeService = new StripePaymentService();
  return _stripeService;
}

// Payment summary - used by StandalonePaymentPage to load payment details
router.get('/contract/:contractId/payment-summary', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const summary = await getContractService().getContractPaymentSummary(contractId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting payment summary:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Create payment intent - used by StandalonePaymentPage to start Stripe payment
router.post('/contract/:contractId/create-payment', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;

    // Verify contract is signed (same validation as Stripe route)
    const pool = getPool();
    const { rows: phiRows } = await pool.query<{ status: string }>(
      'SELECT status FROM phi_contracts WHERE id = $1 LIMIT 1',
      [contractId]
    );
    let contractStatus: string | null = phiRows[0]?.status ?? null;
    if (!contractStatus) {
      const { data: supabaseContract } = await supabase
        .from('contracts')
        .select('status')
        .eq('id', contractId)
        .single();
      contractStatus = supabaseContract?.status ?? null;
    }
    if (!contractStatus) {
      res.status(404).json({ success: false, error: 'Contract not found' });
      return;
    }
    if (contractStatus !== 'signed') {
      res.status(400).json({
        success: false,
        error: 'Contract must be signed before processing payment',
      });
      return;
    }

    const paymentResult = await getStripeService().createNextPaymentIntent(contractId);
    if (!paymentResult) {
      res.status(400).json({
        success: false,
        error: 'No pending payments found for this contract',
      });
      return;
    }
    res.json({
      success: true,
      data: {
        payment_intent_id: paymentResult.payment_intent_id,
        client_secret: paymentResult.client_secret,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: paymentResult.status,
      },
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Record payment success and sync to QuickBooks (alternative to webhook - call from frontend after payment completes)
router.post('/record-payment', async (req: Request, res: Response) => {
  try {
    const { payment_intent_id } = req.body;
    if (!payment_intent_id || typeof payment_intent_id !== 'string') {
      res.status(400).json({ success: false, error: 'payment_intent_id is required' });
      return;
    }

    await getStripeService().recordPaymentSuccess(payment_intent_id);

    res.json({ success: true, message: 'Payment recorded and synced to QuickBooks' });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;


