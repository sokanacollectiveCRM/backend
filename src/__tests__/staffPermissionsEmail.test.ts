import { getPool } from '../db/cloudSqlPool';
import {
  buildStaffPermissionChangeEmail,
  changeStaffPermission,
} from '../features/admin/application/staffPermissions';
import { NodemailerService } from '../services/emailService';
import type { AuthRequest } from '../types';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));

const query = jest.fn();
const release = jest.fn();
const sendEmail = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://dev.example.test/';
  (getPool as jest.Mock).mockReturnValue({
    connect: async () => ({ query, release }),
  });
  (NodemailerService as jest.Mock).mockImplementation(() => ({ sendEmail }));
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT a.id FROM public.admins'))
      return { rowCount: 1, rows: [{ id: 'manager' }] };
    if (sql.includes('SELECT id,email,first_name,full_name'))
      return {
        rowCount: 1,
        rows: [
          {
            id: 'target',
            email: 'STAFF@example.test',
            first_name: 'Maya',
            full_name: 'Maya Rivers',
          },
        ],
      };
    if (sql.startsWith('SELECT 1 FROM public.doula_hr_permissions WHERE'))
      return { rowCount: 0, rows: [] };
    return { rowCount: 1, rows: [] };
  });
});

it('emails the affected staff member after payroll access is enabled', async () => {
  const req = {
    user: { id: 'manager', role: 'admin' },
    tenant: { id: 'tenant' },
    params: { adminId: 'target' },
    body: { capability: 'payroll', enabled: true },
  } as unknown as AuthRequest;

  await expect(changeStaffPermission(req)).resolves.toEqual({ changed: true });
  expect(query).toHaveBeenCalledWith('COMMIT');
  expect(release).toHaveBeenCalled();
  expect(sendEmail).toHaveBeenCalledWith(
    'staff@example.test',
    'Sokana360: Payroll access enabled',
    expect.stringContaining(
      'Hello Maya,\n\nYour Sokana360 staff permissions were updated.'
    )
  );
  expect(sendEmail.mock.calls[0][2]).toContain(
    'The change is effective immediately. No sign-out is required.'
  );
});

it('builds direct enabled and removed messages for each capability', () => {
  const enabled = buildStaffPermissionChangeEmail({
    firstName: 'Maya',
    capability: 'hr',
    enabled: true,
  });
  expect(enabled.subject).toBe('Sokana360: HR access enabled');
  expect(enabled.body).toContain('You now have HR access');
  expect(enabled.body).toContain('W-9 and direct deposit forms');

  const removed = buildStaffPermissionChangeEmail({
    firstName: 'Maya',
    capability: 'payroll',
    enabled: false,
  });
  expect(removed.subject).toBe('Sokana360: Payroll access removed');
  expect(removed.body).toContain(
    'Your Payroll access in Sokana360 was removed'
  );
  expect(removed.body).toContain(
    'https://dev.example.test/settings/staff-permissions'
  );
});
