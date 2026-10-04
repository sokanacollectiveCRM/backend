import { QuickBooksCustomerPayload } from '../domain/quickBooksCustomer';

/** Each lookup returns the QuickBooks customer id, or `null` when not found. */
export interface QuickBooksCustomerDirectory {
  findById(qboCustomerId: string): Promise<string | null>;
  findByEmail(email: string): Promise<string | null>;
  findByDisplayName(displayName: string): Promise<string | null>;
  create(payload: QuickBooksCustomerPayload): Promise<string>;
}

export interface ClientQuickBooksLinkStore {
  saveCustomerId(clientId: string, qboCustomerId: string): Promise<void>;
}

export interface ClientsQuickBooksDeps {
  directory: QuickBooksCustomerDirectory;
  links: ClientQuickBooksLinkStore;
}
