import { getPool } from '../db/cloudSqlPool';
import { User } from '../entities/User';
import { isCurrentAccountActive } from '../security/accountAccess';
import { ROLE } from '../types';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));

const query = jest.fn();
const client = new User({
  id: 'client-auth-id',
  email: 'client@example.test',
  firstname: 'Test',
  lastname: 'Client',
  role: ROLE.CLIENT,
});

describe('current account access', () => {
  beforeEach(() => {
    query.mockReset();
    (getPool as jest.Mock).mockReturnValue({ query });
  });

  it('rechecks portal state so an existing session loses access after disablement', async () => {
    query.mockResolvedValueOnce({ rows: [{ portal_status: 'active' }] });
    await expect(isCurrentAccountActive(client)).resolves.toBe(true);
    query.mockResolvedValueOnce({ rows: [{ portal_status: 'disabled' }] });
    await expect(isCurrentAccountActive(client)).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual([client.id]);
  });

  it('propagates database failure instead of granting access', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(isCurrentAccountActive(client)).rejects.toThrow(
      'database unavailable'
    );
  });

  it('denies inactive staff before any client lookup', async () => {
    const staff = new User({
      id: 'staff-id',
      email: 'staff@example.test',
      firstname: 'Test',
      lastname: 'Staff',
      role: ROLE.DOULA,
      account_status: 'inactive' as any,
    });
    await expect(isCurrentAccountActive(staff)).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
