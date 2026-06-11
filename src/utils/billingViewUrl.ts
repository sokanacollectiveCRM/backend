import { contractNotifications } from '../config/env';

export function getLimitedBillingViewUrl(contractId: string): string {
  const baseUrl = contractNotifications.frontendUrl.replace(/\/+$/, '');
  const path = contractNotifications.billingViewPathTemplate.startsWith('/')
    ? contractNotifications.billingViewPathTemplate
    : `/${contractNotifications.billingViewPathTemplate}`;
  return `${baseUrl}${path.replace(':contractId', encodeURIComponent(contractId))}`;
}
