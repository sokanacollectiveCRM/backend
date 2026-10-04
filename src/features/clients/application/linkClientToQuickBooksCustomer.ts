import { QuickBooksLinkRequest } from '../domain/clientStatus';
import {
  MissingQuickBooksCustomerIdentityError,
  QuickBooksLinkMethod,
  hasQuickBooksCustomerIdentity,
  quickBooksCustomerDraftFor,
} from '../domain/quickBooksCustomer';
import { ClientsQuickBooksDeps } from './ports';

export interface QuickBooksLinkResult {
  qboCustomerId: string;
  alreadyExisted: boolean;
  linkedBy: QuickBooksLinkMethod;
  /** Stored id that no longer exists in the connected QuickBooks company. */
  staleStoredId: string | null;
}

/**
 * Links a converted client to a QuickBooks customer without creating
 * duplicates. A stored id that still exists is trusted and not re-saved.
 */
export async function linkClientToQuickBooksCustomer(
  deps: ClientsQuickBooksDeps,
  request: QuickBooksLinkRequest
): Promise<QuickBooksLinkResult> {
  const { clientId, existingQboCustomerId } = request;
  let staleStoredId: string | null = null;

  if (existingQboCustomerId) {
    const existing = await deps.directory.findById(existingQboCustomerId);
    if (existing) {
      return {
        qboCustomerId: existing,
        alreadyExisted: true,
        linkedBy: 'stored_id',
        staleStoredId: null,
      };
    }
    staleStoredId = existingQboCustomerId;
  }

  if (!hasQuickBooksCustomerIdentity(request)) {
    throw new MissingQuickBooksCustomerIdentityError();
  }

  const { fullName, payload } = quickBooksCustomerDraftFor(request);

  if (request.email) {
    const byEmail = await deps.directory.findByEmail(request.email);
    if (byEmail) {
      await deps.links.saveCustomerId(clientId, byEmail);
      return {
        qboCustomerId: byEmail,
        alreadyExisted: true,
        linkedBy: 'email',
        staleStoredId,
      };
    }
  }

  const byName = await deps.directory.findByDisplayName(fullName);
  if (byName) {
    await deps.links.saveCustomerId(clientId, byName);
    return {
      qboCustomerId: byName,
      alreadyExisted: true,
      linkedBy: 'display_name',
      staleStoredId,
    };
  }

  const created = await deps.directory.create(payload);
  await deps.links.saveCustomerId(clientId, created);
  return {
    qboCustomerId: created,
    alreadyExisted: false,
    linkedBy: 'created',
    staleStoredId,
  };
}
