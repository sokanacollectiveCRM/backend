import Stripe from 'stripe';
import { FEATURE_STRIPE, stripe as stripeConfig } from './env';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!FEATURE_STRIPE) {
    throw new Error('Stripe is disabled (FEATURE_STRIPE=false)');
  }
  if (stripeClient) return stripeClient;
  const secretKey = stripeConfig.secretKey;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY (required when FEATURE_STRIPE=true)');
  }
  stripeClient = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  return stripeClient;
}
