import { queryCloudSql } from '../../db/cloudSqlPool';
import { qboRequest } from '../../utils/qboClient';

export type CustomerQuickBooksSyncStatus =
  | 'linked'
  | 'not_linked'
  | 'link_stale'
  | 'sync_failed'
  | 'syncing';

export interface CustomerQuickBooksSyncResult {
  clientId: string;
  qboCustomerId: string | null;
  status: CustomerQuickBooksSyncStatus;
  lastCheckedAt: string;
  lastSyncedAt: string | null;
  error: string | null;
}
interface ClientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  qbo_customer_id: string | null;
  quickbooks_last_synced_at: Date | string | null;
}

interface QboCustomer {
  Id: string;
  Active?: boolean;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address?: string };
}

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLocaleLowerCase();
}

function customerMatches(client: ClientRow, customer: QboCustomer): boolean {
  if (customer.Active === false) return false;

  const expectedEmail = normalize(client.email);
  const actualEmail = normalize(customer.PrimaryEmailAddr?.Address);
  const emailMatches = !expectedEmail || expectedEmail === actualEmail;

  const expectedFirstName = normalize(client.first_name);
  const actualFirstName = normalize(customer.GivenName);
  const firstNameMatches = !expectedFirstName || expectedFirstName === actualFirstName;

  const expectedLastName = normalize(client.last_name);
  const actualLastName = normalize(customer.FamilyName);
  const lastNameMatches = !expectedLastName || expectedLastName === actualLastName;

  return emailMatches && firstNameMatches && lastNameMatches;
}

function publicError(error: unknown): string {
  if (!(error instanceof Error)) return 'QuickBooks verification failed';
  if (/^QBO \d{3}:/.test(error.message)) return error.message.slice(0, 500);
  return 'QuickBooks verification failed';
}

export async function refreshCustomerQuickBooksSyncStatus(
  clientId: string
): Promise<CustomerQuickBooksSyncResult | null> {
  const { rows } = await queryCloudSql<ClientRow>(
    `SELECT id, first_name, last_name, email, qbo_customer_id, quickbooks_last_synced_at
     FROM public.phi_clients
     WHERE id = $1::uuid
     LIMIT 1`,
    [clientId]
  );
  const client = rows[0];
  if (!client) return null;

  const checkedAt = new Date();
  if (!client.qbo_customer_id) {
    await queryCloudSql(
      `UPDATE public.phi_clients
       SET quickbooks_sync_status = 'not_linked',
           quickbooks_last_checked_at = $2,
           quickbooks_sync_error = NULL
       WHERE id = $1::uuid`,
      [clientId, checkedAt]
    );
    return {
      clientId,
      qboCustomerId: null,
      status: 'not_linked',
      lastCheckedAt: checkedAt.toISOString(),
      lastSyncedAt: client.quickbooks_last_synced_at
        ? new Date(client.quickbooks_last_synced_at).toISOString()
        : null,
      error: null,
    };
  }

  await queryCloudSql(
    `UPDATE public.phi_clients
     SET quickbooks_sync_status = 'syncing', quickbooks_sync_error = NULL
     WHERE id = $1::uuid`,
    [clientId]
  );

  try {
    const escapedId = client.qbo_customer_id.replace(/'/g, "''");
    const query = encodeURIComponent(
      `SELECT Id, Active, GivenName, FamilyName, PrimaryEmailAddr FROM Customer WHERE Id='${escapedId}'`
    );
    const response = await qboRequest<{
      QueryResponse?: { Customer?: QboCustomer[] };
    }>(`/query?query=${query}&minorversion=65`);
    const customer = response.QueryResponse?.Customer?.[0];
    const status: CustomerQuickBooksSyncStatus =
      customer && customerMatches(client, customer) ? 'linked' : 'link_stale';
    const syncedAt = status === 'linked' ? checkedAt : client.quickbooks_last_synced_at;

    await queryCloudSql(
      `UPDATE public.phi_clients
       SET quickbooks_sync_status = $2,
           quickbooks_last_checked_at = $3,
           quickbooks_last_synced_at = CASE WHEN $2 = 'linked' THEN $3 ELSE quickbooks_last_synced_at END,
           quickbooks_sync_error = NULL
       WHERE id = $1::uuid`,
      [clientId, status, checkedAt]
    );
    return {
      clientId,
      qboCustomerId: client.qbo_customer_id,
      status,
      lastCheckedAt: checkedAt.toISOString(),
      lastSyncedAt: syncedAt ? new Date(syncedAt).toISOString() : null,
      error: null,
    };
  } catch (error) {
    const message = publicError(error);
    await queryCloudSql(
      `UPDATE public.phi_clients
       SET quickbooks_sync_status = 'sync_failed',
           quickbooks_last_checked_at = $2,
           quickbooks_sync_error = $3
       WHERE id = $1::uuid`,
      [clientId, checkedAt, message]
    );
    return {
      clientId,
      qboCustomerId: client.qbo_customer_id,
      status: 'sync_failed',
      lastCheckedAt: checkedAt.toISOString(),
      lastSyncedAt: client.quickbooks_last_synced_at
        ? new Date(client.quickbooks_last_synced_at).toISOString()
        : null,
      error: message,
    };
  }
}
