/**
 * Syncs a newly-matched CRM client to QuickBooks Online.
 *
 * Called non-blocking when a lead transitions to status = 'matched'.
 * Before creating, checks QB for an existing customer by email then by
 * display name to avoid duplicates. Only creates if no match is found.
 * Persists the QB Customer ID back to phi_clients for auditing.
 */
import buildCustomerPayload from './buildCustomerPayload';
import createCustomerInQuickBooks from './createCustomerInQuickBooks';
import saveQboCustomerIdToPhiClient from './saveQboCustomerIdToPhiClient';
import findCustomerInQuickBooks, { findCustomerInQuickBooksByDisplayName } from '../payments/findCustomerInQuickBooks';
import { logger } from '../../common/utils/logger';

export interface SyncMatchedClientParams {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  existingQboCustomerId?: string | null;
}

export interface SyncMatchedClientResult {
  qboCustomerId: string;
  alreadyExisted: boolean;
}

export async function syncMatchedClientToQuickBooks(
  params: SyncMatchedClientParams
): Promise<SyncMatchedClientResult> {
  const { clientId, firstName, lastName, email, existingQboCustomerId } = params;

  // 1. CRM record already linked to a QB customer — nothing to do
  if (existingQboCustomerId) {
    logger.info({ clientId, existingQboCustomerId }, '[QB Sync] Client already has a QB customer ID; skipping');
    return { qboCustomerId: existingQboCustomerId, alreadyExisted: true };
  }

  if (!firstName && !lastName && !email) {
    throw new Error('Cannot sync QB customer: no name or email on client record');
  }

  const { fullName, payload } = buildCustomerPayload(
    firstName || 'Unknown',
    lastName || 'Client',
    email || ''
  );

  // 2. Search QB by email first
  if (email) {
    const idByEmail = await findCustomerInQuickBooks(email);
    if (idByEmail) {
      logger.info({ clientId, idByEmail }, '[QB Sync] Found existing QB customer by email; linking without creating');
      await saveQboCustomerIdToPhiClient(clientId, idByEmail);
      return { qboCustomerId: idByEmail, alreadyExisted: true };
    }
  }

  // 3. Search QB by display name (First Last)
  const idByName = await findCustomerInQuickBooksByDisplayName(fullName);
  if (idByName) {
    logger.info({ clientId, idByName }, '[QB Sync] Found existing QB customer by name; linking without creating');
    await saveQboCustomerIdToPhiClient(clientId, idByName);
    return { qboCustomerId: idByName, alreadyExisted: true };
  }

  // 4. No existing QB customer found — create a new one
  const qboCustomer = await createCustomerInQuickBooks(payload);
  const qboCustomerId: string = qboCustomer.Id;

  await saveQboCustomerIdToPhiClient(clientId, qboCustomerId);

  logger.info({ clientId, qboCustomerId }, '[QB Sync] QB customer created and ID saved to phi_clients');

  return { qboCustomerId, alreadyExisted: false };
}
