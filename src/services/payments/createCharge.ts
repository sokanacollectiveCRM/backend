import { getValidAccessToken } from '../../utils/tokenUtils';
import { buildChargePayload, CardDetails } from './buildChargePayload';

export async function createCharge(amount: string, card: CardDetails) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('Could not get QuickBooks access token');
  }

  const payload = buildChargePayload(amount, card);

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
    throw new Error(JSON.stringify(data));
  }
  return data;
} 