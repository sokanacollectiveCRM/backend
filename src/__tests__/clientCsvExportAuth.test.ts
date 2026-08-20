import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

import { logger } from '../common/utils/logger';
import authorizeRoles from '../middleware/authorizeRoles';
import { CLIENT_CSV_EXPORT_ROLES } from '../security/authorizationPolicies';
import { ClientUseCase } from '../usecase/clientUseCase';
import type { AuthRequest } from '../types';

let currentUser: { id: string; role: string; email: string } | null = null;

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (!currentUser) {
      res.status(401).json({
        error: 'No session token provided',
        code: 'UNAUTHENTICATED',
      });
      return;
    }
    req.user = currentUser;
    next();
  },
}));

const exportCSVHandler = jest.fn((req: any, res: any) => {
  res.status(200).type('text/csv').send('first_name,last_name\n"Ada","Lovelace"');
});

jest.mock('../index', () => ({
  clientController: {
    exportCSV: (req: any, res: any) => exportCSVHandler(req, res),
  },
  userController: {},
}));

jest.mock('../supabase', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/portalInviteService', () => ({
  PortalInviteService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../controllers/portalController', () => ({
  PortalController: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../controllers/clientBillingController', () => ({
  generateInstallmentInvoice: jest.fn(),
  getClientPaymentSchedule: jest.fn(),
}));

import clientRoutes from '../routes/clientRoutes';

describe('HIPAA-13A client CSV export authorization', () => {
  const app = express();
  app.use(express.json());
  app.use('/clients', clientRoutes);

  beforeEach(() => {
    currentUser = null;
    jest.clearAllMocks();
  });

  it('keeps CLIENT_CSV_EXPORT_ROLES admin-only', () => {
    expect([...CLIENT_CSV_EXPORT_ROLES]).toEqual(['admin']);
  });

  it('route source allows only admin for /fetchCSV', () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '../routes/clientRoutes.ts'),
      'utf8'
    );
    const start = routeSrc.indexOf("'/fetchCSV'");
    const end = routeSrc.indexOf(');', start) + 2;
    const fetchCsvBlock = routeSrc.slice(start, end);
    expect(fetchCsvBlock).toContain("authorizeRoles(req, res, next, ['admin'])");
    expect(fetchCsvBlock).not.toMatch(/\['admin',\s*'client'\]/);
    expect(fetchCsvBlock).not.toMatch(/'doula'/);
    expect(fetchCsvBlock).not.toMatch(/'billing'/);
  });

  it('rejects unauthenticated export', async () => {
    const res = await request(app).get('/clients/fetchCSV');
    expect(res.status).toBe(401);
    expect(exportCSVHandler).not.toHaveBeenCalled();
  });

  it.each([
    ['client', 'client-user'],
    ['doula', 'doula-user'],
    ['billing', 'billing-user'],
  ] as const)('rejects %s role export', async (role, id) => {
    currentUser = { id, role, email: `${role}@test.example` };
    const res = await request(app).get('/clients/fetchCSV');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(exportCSVHandler).not.toHaveBeenCalled();
  });

  it('allows admin export', async () => {
    currentUser = {
      id: 'admin-user',
      role: 'admin',
      email: 'admin@test.example',
    };
    const res = await request(app).get('/clients/fetchCSV');
    expect(res.status).toBe(200);
    expect(exportCSVHandler).toHaveBeenCalledTimes(1);
  });

  it('use case denies non-admin even if called directly', async () => {
    const repo = {
      exportCSV: jest.fn().mockResolvedValue('a,b\n1,2'),
    };
    const useCase = new ClientUseCase(repo as any, {} as any);
    await expect(useCase.exportCSV('client')).rejects.toThrow(/admin-only/i);
    await expect(useCase.exportCSV('doula')).rejects.toThrow(/admin-only/i);
    await expect(useCase.exportCSV('billing')).rejects.toThrow(/admin-only/i);
    expect(repo.exportCSV).not.toHaveBeenCalled();
  });

  it('use case allows admin', async () => {
    const repo = {
      exportCSV: jest
        .fn()
        .mockResolvedValue(
          'first_name,last_name,annual_income,address_line1\n"A","B","1","2"'
        ),
    };
    const useCase = new ClientUseCase(repo as any, {} as any);
    const csv = await useCase.exportCSV('admin');
    expect(csv).toContain('annual_income');
    expect(repo.exportCSV).toHaveBeenCalledTimes(1);
  });

  it('logs authorization denials without PHI fields', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const req = {
      user: { id: 'u-client-1', role: 'client', email: 'c@test.example' },
      method: 'GET',
      path: '/fetchCSV',
      route: { path: '/fetchCSV' },
    } as unknown as AuthRequest;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    await authorizeRoles(req, res, next, ['admin']);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'backend-authz',
        event: 'authorization_denied',
        userId: 'u-client-1',
        role: 'client',
        method: 'GET',
        route: '/fetchCSV',
        status: 403,
        errorCode: 'FORBIDDEN',
      })
    );
    const logged = JSON.stringify(warnSpy.mock.calls[0][0]);
    expect(logged).not.toMatch(/annual_income|address_line1|first_name|last_name|password/i);
    expect(logged).not.toContain('@test.example');
    warnSpy.mockRestore();
  });
});
