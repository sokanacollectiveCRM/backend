const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock('../db/cloudSqlPool', () => ({
  getPool: () => ({ connect, query: jest.fn() }),
}));

import { refreshQuickBooksToken } from '../utils/tokenUtils';

describe('QuickBooks token refresh safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('reuses a token refreshed by another instance after acquiring the lock', async () => {
    const future = new Date(Date.now() + 30 * 60 * 1000);
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          realm_id: 'realm-1',
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          access_token_expires_at: future,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await refreshQuickBooksToken();

    expect(result?.accessToken).toBe('new-access');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(query.mock.calls[1][0]).toContain('pg_advisory_xact_lock');
    expect(release).toHaveBeenCalled();
  });

  it('retains the token and records reauthorization_required on invalid_grant', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          realm_id: 'realm-1',
          access_token: 'expired-access',
          refresh_token: 'current-refresh',
          access_token_expires_at: new Date(0),
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_grant' }),
    });

    const result = await refreshQuickBooksToken();

    expect(result).toBeNull();
    const healthUpdate = query.mock.calls[3];
    expect(healthUpdate[0]).toContain('last_refresh_failed_at');
    expect(healthUpdate[1]).toContain('reauthorization_required');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE'))).toBe(false);
    expect(release).toHaveBeenCalled();
  });
});
