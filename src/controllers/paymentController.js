'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
class PaymentController {
  disabled(_req, res) {
    res.status(410).json({
      success: false,
      error: 'Stripe payment routes are disabled',
      code: 'stripe_disabled',
    });
  }
  async saveCard(req, res) {
    this.disabled(req, res);
  }
  async processCharge(req, res) {
    this.disabled(req, res);
  }
  async updatePaymentMethod(req, res) {
    this.disabled(req, res);
  }
  async getPaymentMethods(req, res) {
    this.disabled(req, res);
  }
  async getCustomersWithStripeId(req, res) {
    this.disabled(req, res);
  }
}
exports.paymentController = new PaymentController();
