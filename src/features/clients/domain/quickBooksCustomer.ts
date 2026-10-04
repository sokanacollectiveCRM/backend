/**
 * Rules for the QuickBooks customer a CRM client is linked to.
 */

export const QUICKBOOKS_DEFAULT_FIRST_NAME = 'Unknown';
export const QUICKBOOKS_DEFAULT_LAST_NAME = 'Client';

export interface QuickBooksCustomerPayload {
  GivenName: string;
  FamilyName: string;
  DisplayName: string;
  PrimaryEmailAddr: { Address: string };
}

export interface QuickBooksCustomerDraft {
  fullName: string;
  payload: QuickBooksCustomerPayload;
}

export function buildQuickBooksCustomerPayload(
  firstName: string,
  lastName: string,
  email: string
): QuickBooksCustomerDraft {
  const fullName = `${firstName} ${lastName}`;
  return {
    fullName,
    payload: {
      GivenName: firstName,
      FamilyName: lastName,
      DisplayName: fullName,
      PrimaryEmailAddr: { Address: email },
    },
  };
}

export interface QuickBooksCustomerIdentity {
  firstName: string;
  lastName: string;
  email: string;
}

export function hasQuickBooksCustomerIdentity(
  identity: QuickBooksCustomerIdentity
): boolean {
  return Boolean(identity.firstName || identity.lastName || identity.email);
}

/** Fills missing names with defaults so the display name is never blank. */
export function quickBooksCustomerDraftFor(
  identity: QuickBooksCustomerIdentity
): QuickBooksCustomerDraft {
  return buildQuickBooksCustomerPayload(
    identity.firstName || QUICKBOOKS_DEFAULT_FIRST_NAME,
    identity.lastName || QUICKBOOKS_DEFAULT_LAST_NAME,
    identity.email || ''
  );
}

export class MissingQuickBooksCustomerIdentityError extends Error {
  constructor() {
    super('Cannot sync QB customer: no name or email on client record');
    this.name = 'MissingQuickBooksCustomerIdentityError';
  }
}

/**
 * How a client was linked. Lookups run in this order: a stored id that still
 * exists, then email, then display name, then a new customer.
 */
export type QuickBooksLinkMethod =
  | 'stored_id'
  | 'email'
  | 'display_name'
  | 'created';
