"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contractService_1 = require("../services/contractService");
const stripePaymentService_1 = require("../services/payments/stripePaymentService");
const supabase_1 = require("../supabase");
const router = (0, express_1.Router)();
const stripePaymentService = new stripePaymentService_1.StripePaymentService();
/**
 * Get contract details for payment page
 * GET /api/contract-payment/contract/:clientEmail
 */
router.get('/contract/:clientEmail', async (req, res) => {
    try {
        const { clientEmail } = req.params;
        console.log('🔍 Fetching contract for payment:', clientEmail);
        // Get the most recent signed contract for this client
        const contract = await contractService_1.contractService.getContractByClientEmail(clientEmail);
        if (!contract) {
            res.status(404).json({
                success: false,
                error: 'No signed contract found for this client'
            });
            return;
        }
        // Return contract details for payment page
        res.json({
            success: true,
            contract: {
                id: contract.id,
                clientName: contract.client_name,
                clientEmail: contract.client_email,
                depositAmount: contract.deposit_amount,
                totalAmount: contract.total_amount,
                contractData: contract.contract_data,
                status: contract.status,
                signedAt: contract.signed_at
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching contract for payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contract details'
        });
    }
});
/**
 * Process deposit payment for signed contract
 * POST /api/contract-payment/process-deposit
 */
router.post('/process-deposit', async (req, res) => {
    try {
        const { clientEmail, paymentMethodId } = req.body;
        console.log('💳 Processing deposit payment:', { clientEmail, paymentMethodId });
        // Get contract details
        const contract = await contractService_1.contractService.getContractByClientEmail(clientEmail);
        if (!contract) {
            res.status(404).json({
                success: false,
                error: 'No signed contract found for this client'
            });
            return;
        }
        if (contract.status !== 'signed') {
            res.status(400).json({
                success: false,
                error: 'Contract must be signed before payment can be processed'
            });
            return;
        }
        // Get or create Stripe customer
        const { data: userData, error: userError } = await supabase_1.supabase
            .from('users')
            .select('id, email, firstname, lastname')
            .eq('email', clientEmail)
            .single();
        if (userError || !userData) {
            res.status(404).json({
                success: false,
                error: 'Client not found'
            });
            return;
        }
        // Create payment intent for deposit
        const paymentIntent = await stripePaymentService.createPayment({
            customerId: userData.id,
            paymentMethodId,
            amount: contract.deposit_amount * 100, // Convert to cents
            description: `Deposit payment for Postpartum Doula Services - Contract ${contract.id}`
        });
        // Save payment record
        await contractService_1.contractService.savePayment(contract.id, paymentIntent.id, contract.deposit_amount, 'deposit', 'pending');
        console.log('✅ Deposit payment processed:', paymentIntent.id);
        res.json({
            success: true,
            paymentIntent: {
                id: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                amount: contract.deposit_amount,
                status: paymentIntent.status
            },
            contract: {
                id: contract.id,
                depositAmount: contract.deposit_amount,
                totalAmount: contract.total_amount,
                remainingAmount: contract.total_amount - contract.deposit_amount
            }
        });
    }
    catch (error) {
        console.error('❌ Error processing deposit payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process deposit payment'
        });
    }
});
/**
 * Webhook to handle SignNow contract signing completion
 * POST /api/contract-payment/signnow-webhook
 */
router.post('/signnow-webhook', async (req, res) => {
    try {
        const { document_id, event } = req.body;
        console.log('📨 SignNow webhook received:', { document_id, event });
        // Handle document completion event
        if (event === 'document.complete') {
            // Mark contract as signed
            await contractService_1.contractService.markContractAsSigned(document_id);
            console.log('✅ Contract marked as signed:', document_id);
            res.json({
                success: true,
                message: 'Contract status updated successfully'
            });
        }
        else {
            console.log('ℹ️ Unhandled SignNow event:', event);
            res.json({
                success: true,
                message: 'Event received but not processed'
            });
        }
    }
    catch (error) {
        console.error('❌ Error processing SignNow webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process webhook'
        });
    }
});
/**
 * Get payment history for a contract
 * GET /api/contract-payment/history/:contractId
 */
router.get('/history/:contractId', async (req, res) => {
    try {
        const { contractId } = req.params;
        const { data: payments, error } = await supabase_1.supabase
            .from('contract_payments')
            .select('*')
            .eq('contract_id', contractId)
            .order('created_at', { ascending: false });
        if (error) {
            throw error;
        }
        res.json({
            success: true,
            payments: payments || []
        });
    }
    catch (error) {
        console.error('❌ Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history'
        });
    }
});
exports.default = router;
