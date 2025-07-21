"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = void 0;
const zod_1 = require("zod");
const stripePaymentService_1 = require("../services/payments/stripePaymentService");
const paymentService = new stripePaymentService_1.StripePaymentService();
// Validation schemas
const saveCardSchema = zod_1.z.object({
    cardToken: zod_1.z.string(),
});
const chargeCardSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().optional(),
});
const updateCardSchema = zod_1.z.object({
    cardToken: zod_1.z.string(),
});
class PaymentController {
    async saveCard(req, res) {
        try {
            const { customerId } = req.params;
            const { cardToken } = req.body;
            // Verify the authenticated user has permission for this customer
            if (req.user.id !== customerId && req.user.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to perform this action'
                });
                return;
            }
            const card = await paymentService.saveCard({
                customerId,
                cardToken,
            });
            res.json({
                success: true,
                data: card,
            });
        }
        catch (error) {
            console.error('Error saving card:', error);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    async processCharge(req, res) {
        try {
            const { customerId } = req.params;
            const { amount, description } = req.body;
            // Verify the authenticated user has permission for this customer
            if (req.user.id !== customerId && req.user.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to perform this action'
                });
                return;
            }
            const charge = await paymentService.chargeCard({
                customerId,
                amount,
                description,
            });
            res.json({
                success: true,
                data: charge,
            });
        }
        catch (error) {
            console.error('Error processing charge:', error);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    async updatePaymentMethod(req, res) {
        try {
            const { customerId, paymentMethodId } = req.params;
            const { cardToken } = req.body;
            // Verify the authenticated user has permission for this customer
            if (req.user.id !== customerId && req.user.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to perform this action'
                });
                return;
            }
            const updatedCard = await paymentService.updateCard({
                customerId,
                cardToken,
                paymentMethodId,
            });
            res.json({
                success: true,
                data: updatedCard,
            });
        }
        catch (error) {
            console.error('Error updating payment method:', error);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    async getPaymentMethods(req, res) {
        try {
            const { customerId } = req.params;
            // Verify the authenticated user has permission for this customer
            if (req.user.id !== customerId && req.user.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Not authorized to perform this action'
                });
                return;
            }
            const paymentMethods = await paymentService.getPaymentMethods(customerId);
            res.json({
                success: true,
                data: paymentMethods,
            });
        }
        catch (error) {
            console.error('Error fetching payment methods:', error);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    async getCustomersWithStripeId(req, res) {
        try {
            // Only allow admins to fetch all customers
            if (req.user.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
                return;
            }
            const customers = await paymentService.getCustomersWithStripeId();
            res.json({
                success: true,
                data: customers,
            });
        }
        catch (error) {
            console.error('Error fetching customers with Stripe ID:', error);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}
exports.paymentController = new PaymentController();
