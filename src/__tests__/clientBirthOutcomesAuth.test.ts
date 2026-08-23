import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

import clientRoutes from '../routes/clientRoutes';

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

const updateBirthOutcomesHandler = jest.fn((req: any, res: any) => {
  res.status(200).json({
    success: true,
    data: {
      birth_outcomes_induction: req.body.birth_outcomes_induction,
      birth_outcomes_delivery_type: req.body.birth_outcomes_delivery_type,
      birth_outcomes_medications_used: req.body.birth_outcomes_medications_used,
    },
  });
});

jest.mock('../index', () => ({
  clientController: {
    updateClientBirthOutcomes: (req: any, res: any) =>
      updateBirthOutcomesHandler(req, res),
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

const clientId = '123e4567-e89b-12d3-a456-426614174000';
const validBody = {
  birth_outcomes_induction: true,
  birth_outcomes_delivery_type: 'Emergency Cesarean',
  birth_outcomes_medications_used: ['Pitocin'],
};

describe('INV-12 birth-outcomes route authorization', () => {
  const app = express();
  app.use(express.json());
  app.use('/clients', clientRoutes);

  beforeEach(() => {
    currentUser = null;
    jest.clearAllMocks();
  });

  it('route source requires authMiddleware and admin|doula roles', () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '../routes/clientRoutes.ts'),
      'utf8'
    );
    const start = routeSrc.indexOf("'/:id/birth-outcomes'");
    const end = routeSrc.indexOf(');', start) + 2;
    const block = routeSrc.slice(start, end);
    expect(block).toContain('authMiddleware');
    expect(block).toContain(
      "authorizeRoles(req, res, next, ['admin', 'doula'])"
    );
    expect(block).toContain('updateClientBirthOutcomes');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .put(`/clients/${clientId}/birth-outcomes`)
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(updateBirthOutcomesHandler).not.toHaveBeenCalled();
  });

  it.each([
    ['client', 'client-user'],
    ['billing', 'billing-user'],
  ] as const)('rejects inactive %s role at route layer', async (role, id) => {
    currentUser = { id, role, email: `${role}@test.example` };
    const res = await request(app)
      .put(`/clients/${clientId}/birth-outcomes`)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(updateBirthOutcomesHandler).not.toHaveBeenCalled();
  });

  it('allows admin and doula roles through route middleware', async () => {
    currentUser = {
      id: 'admin-user',
      role: 'admin',
      email: 'admin@test.example',
    };
    const res = await request(app)
      .put(`/clients/${clientId}/birth-outcomes`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(updateBirthOutcomesHandler).toHaveBeenCalledTimes(1);
  });
});
