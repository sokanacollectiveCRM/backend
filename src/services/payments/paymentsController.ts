import { RequestHandler } from 'express';
import { createCharge } from './createCharge';

export const simulatePaymentController: RequestHandler = async (req, res) => {
  try {
    const { amount, card } = req.body;
    if (!amount || !card) {
      res.status(400).json({ error: 'Missing amount or card details' });
      return;
    }
    const data = await createCharge(amount, card);
    res.json(data);
  } catch (error) {
    let message = error.message;
    try { message = JSON.parse(error.message); } catch {}
    res.status(500).json({ error: message });
  }
}; 