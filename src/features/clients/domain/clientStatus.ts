/**
 * Client status-change rules. No Express, database, or vendor SDK imports.
 */

/**
 * Statuses that convert a lead into a customer. Matching is exact and
 * case-sensitive: `Matched` does not count.
 */
export const CUSTOMER_CONVERSION_STATUSES = ['matched', 'customer'] as const;

export type CustomerConversionStatus =
  (typeof CUSTOMER_CONVERSION_STATUSES)[number];

/** Returns the trimmed status, or `null` when it is not a non-empty string. */
export function parseClientStatusInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function isCustomerConversionStatus(
  status: string
): status is CustomerConversionStatus {
  return (CUSTOMER_CONVERSION_STATUSES as readonly string[]).includes(status);
}

/** `matched_at` is set the first time a client converts and never moved. */
export function shouldStampMatchedAt(status: string): boolean {
  return isCustomerConversionStatus(status);
}

export function shouldLinkQuickBooksCustomer(status: string): boolean {
  return isCustomerConversionStatus(status);
}

export interface ClientStatusRowFields {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  qbo_customer_id?: string | null;
}

export interface QuickBooksLinkRequest {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  existingQboCustomerId?: string | null;
}

export function quickBooksLinkRequestFromClientRow(
  clientId: string,
  row: ClientStatusRowFields
): QuickBooksLinkRequest {
  return {
    clientId,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    email: row.email || '',
    existingQboCustomerId: row.qbo_customer_id,
  };
}
