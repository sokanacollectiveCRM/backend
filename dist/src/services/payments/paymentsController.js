'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.simulatePaymentController = void 0;
const createCharge_1 = require('./createCharge');
const simulatePaymentController = async (req, res) => {
  try {
    const { amount, card } = req.body;
    if (!amount || !card) {
      res.status(400).json({ error: 'Missing amount or card details' });
      return;
    }
    const data = await (0, createCharge_1.createCharge)(amount, card);
    res.json(data);
  } catch (error) {
    let message = error.message;
    try {
      message = JSON.parse(error.message);
    } catch {}
    res.status(500).json({ error: message });
  }
};
exports.simulatePaymentController = simulatePaymentController;
