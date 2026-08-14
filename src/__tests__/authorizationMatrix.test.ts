/**
 * PR 4 authorization matrix / security smoke expansion.
 * Mocks auth middleware — no network, no providers, no open handles beyond closed servers.
 */

let currentUser:
  | { id: string; role: string; email: string }
  | null = null;

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (!currentUser) {
      res.status(401).json({
        error: 'No session token provided',
        hint: 'Provide Cookie or X-Session-Token header',
      });
      return;
    }
    req.user = currentUser;
    next();
  },
  getSessionToken: () => undefined,
  getSessionTokenAndSource: () => ({}),
  SESSION_COOKIE: 'sb-access-token',
  SESSION_HEADER: 'x-session-token',
}));

jest.mock('../services/signNowService', () => ({
  SignNowService: jest.fn().mockImplementation(() => ({
    testAuthentication: jest.fn().mockResolvedValue({ success: true }),
    testTemplate: jest.fn().mockResolvedValue({ success: true }),
    listTemplates: jest.fn().mockResolvedValue({ success: true }),
    getTemplateFields: jest.fn().mockResolvedValue({ success: true }),
    createPrefilledDocFromTemplate: jest.fn().mockResolvedValue({ documentId: 'doc-1' }),
    inspectDocumentFields: jest.fn().mockResolvedValue({ fields: [] }),
    createInvitationClientPartner: jest.fn().mockResolvedValue({ success: true }),
    apiToken: 'test-token',
  })),
  signNowService: {
    testAuthentication: jest.fn().mockResolvedValue({ success: true }),
    testTemplate: jest.fn().mockResolvedValue({ success: true }),
    listTemplates: jest.fn().mockResolvedValue({ success: true }),
    getTemplateFields: jest.fn().mockResolvedValue({ success: true }),
    createPrefilledDocFromTemplate: jest.fn().mockResolvedValue({ documentId: 'doc-1' }),
    inspectDocumentFields: jest.fn().mockResolvedValue({ fields: [] }),
    createInvitationClientPartner: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../controllers/signNowWebhookController', () => ({
  signNowCallback: (_req: any, res: any) => res.status(200).json({ received: true }),
}));

jest.mock('../controllers/quickbooksWebhookController', () => ({
  quickBooksInvoicePaidWebhook: (_req: any, res: any) => res.status(200).json({ received: true }),
}));

// HMAC is covered in webhookAndOauthSecurity.test.ts. This suite only asserts
// webhooks are not behind CRM session auth (dotenv secrets would otherwise 401).
jest.mock('../security/webhookAuth', () => ({
  requireSignNowWebhookAuth: (_req: any, _res: any, next: any) => next(),
  requireQuickBooksWebhookAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../controllers/quickbooksController', () => ({
  connectQuickBooks: (_req: any, res: any) => res.status(200).json({ ok: true }),
  handleQuickBooksCallback: (_req: any, res: any) => res.status(200).json({ ok: true }),
  quickBooksAuthUrl: (_req: any, res: any) => res.status(200).json({ url: 'https://example.test' }),
  quickBooksStatus: (_req: any, res: any) => res.status(200).json({ connected: false }),
  getInvoices: (_req: any, res: any) => res.status(200).json([]),
  getQuickBooksCustomers: (_req: any, res: any) => res.status(200).json([]),
  getInvoiceableCustomersController: (_req: any, res: any) => res.status(200).json([]),
  refreshQuickBooksCustomerSyncStatus: (_req: any, res: any) => res.status(200).json({ ok: true }),
  createCustomer: (_req: any, res: any) => res.status(200).json({ ok: true }),
  quickBooksDisconnect: (_req: any, res: any) => res.status(200).json({ ok: true }),
  createInvoice: (_req: any, res: any) => res.status(201).json({ ok: true }),
}));

jest.mock('../services/payments/paymentsController', () => ({
  simulatePaymentController: (_req: any, res: any) => res.status(200).json({ ok: true }),
}));

jest.mock('../services/simplePaymentService', () => ({
  SimplePaymentService: jest.fn().mockImplementation(() => ({
    getPaymentDashboard: jest.fn().mockResolvedValue({ total: 0 }),
    getOverduePayments: jest.fn().mockResolvedValue([]),
    getPaymentSummary: jest.fn().mockResolvedValue({ balance: 0 }),
    getPaymentSchedule: jest.fn().mockResolvedValue([]),
    getContractPayments: jest.fn().mockResolvedValue([]),
    updatePaymentStatus: jest.fn().mockResolvedValue({ id: 'p1', status: 'succeeded' }),
    getPaymentsByStatus: jest.fn().mockResolvedValue([]),
    getPaymentsDueBetween: jest.fn().mockResolvedValue([]),
    runDailyMaintenance: jest.fn().mockResolvedValue(undefined),
    updateOverdueFlags: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../services/contractClientService', () => ({
  ContractClientService: jest.fn().mockImplementation(() => ({
    getContractWithClient: jest.fn().mockImplementation(async (contractId: string) => {
      if (contractId === 'other-contract') {
        return { contract: { id: contractId, client_id: 'client-other' } };
      }
      if (contractId === 'own-contract') {
        return { contract: { id: contractId, client_id: 'client-own' } };
      }
      return null;
    }),
  })),
}));

jest.mock('../services/cloudSqlDoulaAssignmentService', () => ({
  CloudSqlDoulaAssignmentService: jest.fn().mockImplementation(() => ({
    getClientIdByAuthUserId: jest.fn().mockImplementation(async (userId: string) => {
      if (userId === 'client-user') return 'client-own';
      return null;
    }),
  })),
}));

jest.mock('../repositories/cloudSqlPaymentRepository', () => ({
  listPaymentsFromCloudSql: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/postpartum/calculateContract', () => ({
  calculatePostpartumContract: jest.fn().mockReturnValue({ total_amount: 1 }),
  formatForSignNow: jest.fn().mockReturnValue({}),
  ValidationError: class ValidationError extends Error {},
}));

jest.mock('../utils/signNowContractProcessor', () => ({
  processContractWithSignNow: jest.fn().mockResolvedValue({
    success: true,
    clientEmail: 'c@example.test',
    emailDelivery: { message: 'ok' },
  }),
  checkSignNowDocumentStatus: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../utils/pdfContractProcessor', () => ({
  getAvailableContractTemplates: jest.fn().mockReturnValue(['labor_support_v1']),
  processContractWithPdfTemplate: jest.fn().mockResolvedValue({ ok: true }),
  validateContractDataForTemplate: jest.fn().mockReturnValue({ valid: true, missingFields: [] }),
}));

import express from 'express';
import http, { Server } from 'http';
import request from 'supertest';

import {
  decideClientResourceAccess,
  decideOwnershipAccess,
  roleAllows,
} from '../security/authorizationPolicies';
import {
  PILOT_CRITICAL_PROTECTED_PREFIXES,
  PILOT_CRITICAL_PUBLIC_PATHS,
  SECURITY_SMOKE_BASELINE,
} from '../security/securitySmokeBaseline';

import paymentRoutes from '../routes/paymentRoutes';
import contractSigningRoutes from '../routes/contractSigningRoutes';
import signNowRoutes from '../routes/signNowRoutes';
import contractRoutes from '../routes/contractRoutes';
import pdfContractRoutes from '../routes/pdfContractRoutes';
import customersRoutes from '../routes/customersRoutes';
import quickbooksRoutes from '../routes/quickbooksRoutes';

async function listen(app: express.Application): Promise<Server> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return server;
}

async function closeServer(server: Server): Promise<void> {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function buildApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentRoutes);
  app.use('/api/contract-signing', contractSigningRoutes);
  app.use('/api/signnow', signNowRoutes);
  app.use('/api/contract', contractRoutes);
  app.use('/api/pdf-contract', pdfContractRoutes);
  app.use('/quickbooks/customers', customersRoutes);
  app.use('/quickbooks', quickbooksRoutes);
  app.use('/api/quickbooks', quickbooksRoutes);
  return app;
}

describe('authorizationPolicies', () => {
  it('allows listed roles and denies others', () => {
    expect(roleAllows({ id: '1', email: 'a@b.c', role: 'admin' }, ['admin', 'billing'])).toBe(true);
    expect(roleAllows({ id: '1', email: 'a@b.c', role: 'client' }, ['admin', 'billing'])).toBe(false);
    expect(roleAllows(null, ['admin'])).toBe(false);
  });

  it('enforces ownership-or-staff', () => {
    expect(
      decideOwnershipAccess({
        actor: { id: 'u1', role: 'client' },
        resourceOwnerId: 'u1',
        staffRoles: ['admin'],
      })
    ).toBe('allow');
    expect(
      decideOwnershipAccess({
        actor: { id: 'u1', role: 'client' },
        resourceOwnerId: 'u2',
        staffRoles: ['admin'],
      })
    ).toBe('deny');
    expect(
      decideOwnershipAccess({
        actor: { id: 'staff', role: 'admin' },
        resourceOwnerId: 'u2',
        staffRoles: ['admin'],
      })
    ).toBe('allow');
  });

  it('prevents client IDOR across client resources', () => {
    expect(
      decideClientResourceAccess({
        actor: { id: 'u1', role: 'client' },
        requestedClientId: 'c1',
        actorClientId: 'c1',
      })
    ).toBe('allow');
    expect(
      decideClientResourceAccess({
        actor: { id: 'u1', role: 'client' },
        requestedClientId: 'c2',
        actorClientId: 'c1',
      })
    ).toBe('deny');
  });
});

describe('PR4 auth matrix HTTP', () => {
  let server: Server;
  let app: express.Application;

  beforeEach(async () => {
    currentUser = null;
    app = buildApp();
    server = await listen(app);
  });

  afterEach(async () => {
    await closeServer(server);
  });

  const anonDenied = [
    ['GET', '/api/payments/dashboard'],
    ['GET', '/api/payments/overdue'],
    ['PUT', '/api/payments/payment/p1/status'],
    ['POST', '/api/payments/maintenance/daily'],
    ['GET', '/api/contract-signing/test-auth'],
    ['POST', '/api/contract-signing/generate-contract'],
    ['POST', '/api/signnow/test-auth'],
    ['POST', '/api/signnow/send-client-partner'],
    ['POST', '/api/contract/postpartum/calculate'],
    ['GET', '/api/pdf-contract/templates'],
    ['POST', '/quickbooks/customers'],
    ['GET', '/quickbooks/customers/invoiceable'],
    ['GET', '/quickbooks/status'],
    ['GET', '/api/quickbooks/status'],
  ] as const;

  it.each(anonDenied)('denies anonymous %s %s', async (method, path) => {
    const res = await request(server)[method.toLowerCase() as 'get' | 'post' | 'put'](path);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/No session token provided/i);
  });

  it('keeps SignNow webhook off CRM session auth', async () => {
    const res = await request(server).post('/api/signnow/callback').send({}).expect(200);
    expect(res.body).toEqual({ received: true });
  });

  it('keeps QuickBooks webhook publicly reachable on aliases', async () => {
    await request(server).post('/quickbooks/webhooks/invoice-paid').send({}).expect(200);
    await request(server).post('/api/quickbooks/webhooks/invoice-paid').send({}).expect(200);
  });

  it('allows admin on newly protected payment dashboard', async () => {
    currentUser = { id: 'a1', role: 'admin', email: 'admin@test' };
    const res = await request(server).get('/api/payments/dashboard').expect(200);
    expect(res.body.success).toBe(true);
  });

  it('denies client on payment maintenance', async () => {
    currentUser = { id: 'client-user', role: 'client', email: 'c@test' };
    const res = await request(server).post('/api/payments/maintenance/daily');
    expect(res.status).toBe(403);
  });

  it('denies doula on admin-only contract signing', async () => {
    currentUser = { id: 'd1', role: 'doula', email: 'd@test' };
    const res = await request(server).get('/api/contract-signing/test-auth');
    expect(res.status).toBe(403);
  });

  it('allows admin on contract signing and SignNow send', async () => {
    currentUser = { id: 'a1', role: 'admin', email: 'admin@test' };
    await request(server).get('/api/contract-signing/test-auth').expect(200);
    await request(server)
      .post('/api/signnow/send-client-partner')
      .send({ client: { email: 'c@test', name: 'C' }, documentId: 'doc' })
      .expect(200);
  });

  it('allows billing on QB customers alias and denies client', async () => {
    currentUser = { id: 'b1', role: 'billing', email: 'b@test' };
    await request(server).get('/quickbooks/customers/invoiceable').expect(200);

    currentUser = { id: 'client-user', role: 'client', email: 'c@test' };
    const denied = await request(server).get('/quickbooks/customers/invoiceable');
    expect(denied.status).toBe(403);
  });

  it('enforces client ownership on payment summary', async () => {
    currentUser = { id: 'client-user', role: 'client', email: 'c@test' };
    await request(server).get('/api/payments/contract/own-contract/summary').expect(200);
    const other = await request(server).get('/api/payments/contract/other-contract/summary');
    expect(other.status).toBe(403);
    expect(other.body.error).toMatch(/Forbidden/i);
  });

  it('records matrix documentation in smoke baseline', () => {
    expect(SECURITY_SMOKE_BASELINE.docs).toEqual(
      expect.arrayContaining(['docs/ENDPOINT_AUTHORIZATION_MATRIX.md'])
    );
    expect(PILOT_CRITICAL_PUBLIC_PATHS).toEqual(
      expect.arrayContaining([
        'GET /health',
        'POST /requestService/requestSubmission',
        'POST /api/signnow/callback',
        'POST /quickbooks/webhooks/invoice-paid',
      ])
    );
    expect(PILOT_CRITICAL_PROTECTED_PREFIXES).toEqual(
      expect.arrayContaining([
        '/api/payments',
        '/api/contract-signing',
        '/api/signnow',
        '/api/pdf-contract',
        '/api/contract',
      ])
    );
  });
});
