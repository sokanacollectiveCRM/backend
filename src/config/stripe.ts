import Stripe from 'stripe';
import { requireEnv } from '../utils/env';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = requireEnv('STRIPE_SECRET_KEY');
  stripeClient = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  return stripeClient;
}
