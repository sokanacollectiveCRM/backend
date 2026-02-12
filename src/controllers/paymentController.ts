import { Request, Response } from 'express';
import { z } from 'zod';
import { FEATURE_STRIPE } from '../config/env';
import { StripePaymentService } from '../services/payments/stripePaymentService';

let paymentServiceInstance: StripePaymentService | null = null;

function getPaymentService(): StripePaymentService {
  if (!FEATURE_STRIPE) {
    throw new Error('Stripe is disabled (FEATURE_STRIPE=false)');
  }
  if (!paymentServiceInstance) {
    paymentServiceInstance = new StripePaymentService();
  }
  return paymentServiceInstance;
}

// Validation schemas
const saveCardSchema = z.object({
  cardToken: z.string(),
});

const chargeCardSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
});

const updateCardSchema = z.object({
  cardToken: z.string(),
});

class PaymentController {
  async saveCard(req: Request, res: Response): Promise<void> {
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

      const card = await getPaymentService().saveCard({
        customerId,
        cardToken,
      });

      res.json({
        success: true,
        data: card,
      });
    } catch (error) {
      console.error('Error saving card:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async processCharge(req: Request, res: Response): Promise<void> {
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

      const charge = await getPaymentService().chargeCard({
        customerId,
        amount,
        description,
      });

      res.json({
        success: true,
        data: charge,
      });
    } catch (error) {
      console.error('Error processing charge:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updatePaymentMethod(req: Request, res: Response): Promise<void> {
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

      const updatedCard = await getPaymentService().updateCard({
        customerId,
        cardToken,
        paymentMethodId,
      });

      res.json({
        success: true,
        data: updatedCard,
      });
    } catch (error) {
      console.error('Error updating payment method:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getPaymentMethods(req: Request, res: Response): Promise<void> {
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

      const paymentMethods = await getPaymentService().getPaymentMethods(customerId);

      res.json({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getCustomersWithStripeId(req: Request, res: Response): Promise<void> {
    try {
      // Only allow admins to fetch all customers
      if (req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const customers = await getPaymentService().getCustomersWithStripeId();

      res.json({
        success: true,
        data: customers,
      });
    } catch (error) {
      console.error('Error fetching customers with Stripe ID:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const paymentController = new PaymentController(); 