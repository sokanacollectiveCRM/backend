import { Request, Response } from 'express';

class PaymentController {
  private disabled(_req: Request, res: Response): void {
    res.status(410).json({
      success: false,
      error: 'Stripe payment routes are disabled',
      code: 'stripe_disabled',
    });
  }

  async saveCard(req: Request, res: Response): Promise<void> {
    this.disabled(req, res);
  }

  async processCharge(req: Request, res: Response): Promise<void> {
    this.disabled(req, res);
  }

  async updatePaymentMethod(req: Request, res: Response): Promise<void> {
    this.disabled(req, res);
  }

  async getPaymentMethods(req: Request, res: Response): Promise<void> {
    this.disabled(req, res);
  }

  async getCustomersWithStripeId(req: Request, res: Response): Promise<void> {
    this.disabled(req, res);
  }
}

export const paymentController = new PaymentController();
