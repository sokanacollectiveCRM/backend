/**
 * Public clients feature API.
 * Cross-feature consumers should import from this barrel only.
 *
 * Infrastructure adapters are wired in `composition.ts`, which is not
 * re-exported here so legacy repositories can import this barrel.
 */

export {
  CUSTOMER_CONVERSION_STATUSES,
  parseClientStatusInput,
  isCustomerConversionStatus,
  shouldStampMatchedAt,
  shouldLinkQuickBooksCustomer,
  quickBooksLinkRequestFromClientRow,
} from './domain/clientStatus';
export type {
  CustomerConversionStatus,
  ClientStatusRowFields,
  QuickBooksLinkRequest,
} from './domain/clientStatus';

export {
  QUICKBOOKS_DEFAULT_FIRST_NAME,
  QUICKBOOKS_DEFAULT_LAST_NAME,
  MissingQuickBooksCustomerIdentityError,
  buildQuickBooksCustomerPayload,
  hasQuickBooksCustomerIdentity,
  quickBooksCustomerDraftFor,
} from './domain/quickBooksCustomer';
export type {
  QuickBooksCustomerPayload,
  QuickBooksCustomerDraft,
  QuickBooksCustomerIdentity,
  QuickBooksLinkMethod,
} from './domain/quickBooksCustomer';

export type {
  QuickBooksCustomerDirectory,
  ClientQuickBooksLinkStore,
  ClientsQuickBooksDeps,
} from './application/ports';
export { linkClientToQuickBooksCustomer } from './application/linkClientToQuickBooksCustomer';
export type { QuickBooksLinkResult } from './application/linkClientToQuickBooksCustomer';
