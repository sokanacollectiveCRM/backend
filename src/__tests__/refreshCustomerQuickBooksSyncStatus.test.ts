import { queryCloudSql } from '../db/cloudSqlPool';
import { refreshCustomerQuickBooksSyncStatus } from '../services/customer/refreshCustomerQuickBooksSyncStatus';
import { qboRequest } from '../utils/qboClient';

jest.mock('../db/cloudSqlPool', () => ({ queryCloudSql: jest.fn() }));
jest.mock('../utils/qboClient', () => ({ qboRequest: jest.fn() }));

const queryMock = queryCloudSql as jest.Mock;
const qboMock = qboRequest as jest.Mock;

describe('refreshCustomerQuickBooksSyncStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not_linked without calling QuickBooks when no customer ID is stored', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'client-1', qbo_customer_id: null, quickbooks_last_synced_at: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await refreshCustomerQuickBooksSyncStatus('client-1');

    expect(result?.status).toBe('not_linked');
    expect(qboMock).not.toHaveBeenCalled();
  });

  it('returns linked when the QuickBooks customer exists and identity fields match', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'client-1', first_name: 'Ana', last_name: 'Silva', email: 'ana@example.com',
          qbo_customer_id: 'QB-1', quickbooks_last_synced_at: null,
        }],
      })
      .mockResolvedValue({ rows: [] });
    qboMock.mockResolvedValue({
      QueryResponse: {
        Customer: [{
          Id: 'QB-1', Active: true, GivenName: 'Ana', FamilyName: 'Silva',
          PrimaryEmailAddr: { Address: 'ANA@example.com' },
        }],
      },
    });

    const result = await refreshCustomerQuickBooksSyncStatus('client-1');

    expect(result?.status).toBe('linked');
    expect(queryMock.mock.calls[1][0]).toContain("quickbooks_sync_status = 'syncing'");
  });

  it('returns link_stale when the linked QuickBooks customer differs from CRM', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'client-1', first_name: 'Ana', last_name: 'Silva', email: 'ana@example.com',
          qbo_customer_id: 'QB-1', quickbooks_last_synced_at: null,
        }],
      })
      .mockResolvedValue({ rows: [] });
    qboMock.mockResolvedValue({
      QueryResponse: {
        Customer: [{ Id: 'QB-1', Active: true, GivenName: 'Ana', FamilyName: 'Silva', PrimaryEmailAddr: { Address: 'old@example.com' } }],
      },
    });

    const result = await refreshCustomerQuickBooksSyncStatus('client-1');

    expect(result?.status).toBe('link_stale');
  });

  it('persists sync_failed when QuickBooks cannot be checked', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'client-1', qbo_customer_id: 'QB-1', quickbooks_last_synced_at: null }],
      })
      .mockResolvedValue({ rows: [] });
    qboMock.mockRejectedValue(new Error('QBO 503: unavailable'));

    const result = await refreshCustomerQuickBooksSyncStatus('client-1');

    expect(result).toMatchObject({ status: 'sync_failed', error: 'QBO 503: unavailable' });
    expect(queryMock.mock.calls[2][0]).toContain("quickbooks_sync_status = 'sync_failed'");
  });
});
