import { qboRequest } from '../../utils/qboClient';

export default async function createCustomerInQuickBooks(
  qboPayload: any
): Promise<any> {
  const { Customer } = await qboRequest(
    '/customer?minorversion=65',
    { method: 'POST', body: JSON.stringify(qboPayload) }
  );
  return Customer;
}
