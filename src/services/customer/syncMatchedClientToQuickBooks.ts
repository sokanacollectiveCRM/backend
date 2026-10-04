/**
 * Legacy façade over the clients feature QuickBooks link.
 * Called non-blocking when a client converts (`matched` / `customer`).
 */
import { logger } from '../../common/utils/logger';
import { linkClientToQuickBooksCustomer } from '../../features/clients';
import { createClientsQuickBooksDeps } from '../../features/clients/composition';

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
  const { clientId } = params;
  const result = await linkClientToQuickBooksCustomer(
    createClientsQuickBooksDeps(),
    params
  );

  if (result.staleStoredId) {
    logger.warn(
      { clientId, existingQboCustomerId: result.staleStoredId },
      '[QB Sync] Stored QB customer ID was not found in connected company; relinked'
    );
  }

  const { qboCustomerId } = result;
  switch (result.linkedBy) {
    case 'stored_id':
      logger.info(
        { clientId, existingQboCustomerId: qboCustomerId },
        '[QB Sync] Client already has a valid QB customer ID; skipping'
      );
      break;
    case 'email':
      logger.info(
        { clientId, idByEmail: qboCustomerId },
        '[QB Sync] Found existing QB customer by email; linking without creating'
      );
      break;
    case 'display_name':
      logger.info(
        { clientId, idByName: qboCustomerId },
        '[QB Sync] Found existing QB customer by name; linking without creating'
      );
      break;
    case 'created':
      logger.info(
        { clientId, qboCustomerId },
        '[QB Sync] QB customer created and ID saved to phi_clients'
      );
      break;
  }

  return { qboCustomerId, alreadyExisted: result.alreadyExisted };
}
