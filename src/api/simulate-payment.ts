import express from 'express';
import { getValidAccessToken } from '../utils/tokenUtils';

const router = express.Router();

router.post('/api/simulate-payment', async (req, res) => {
  try {
    const { amount, card } = req.body;
    if (!amount || !card) {
      return res.status(400).json({ error: 'Missing amount or card details' });
    }

    // Get access token (hardcoded or from user context)
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return res.status(401).json({ error: 'Could not get QuickBooks access token' });
    }

    // Prepare payload for QuickBooks Payments API
    const payload = {
      amount: amount.toString(),
      currency: 'USD',
      card: {
        number: card.number,
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvc: card.cvc
      },
      context: {
        isEcommerce: true
      }
    };

    // Call QuickBooks Payments API
    const response = await fetch('https://sandbox.api.intuit.com/quickbooks/v4/payments/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    return res.json(data);
  } catch (error) {
    console.error('Simulate payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 