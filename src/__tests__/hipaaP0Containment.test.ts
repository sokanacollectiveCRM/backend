import express from 'express';
import request from 'supertest';

import { User } from '../entities/User';
import { normalizePublicIntakeSubmission } from '../features/intake/domain/normalizePublicSubmission';
import financialRoutes from '../routes/financialRoutes';
import invoiceRoutes from '../routes/invoiceRoutes';
import { isAccountActive } from '../security/accountAccess';
import { ROLE } from '../types';

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = {
      id: `${req.header('x-test-role')}-1`,
      email: `${req.header('x-test-role')}@example.test`,
      role: req.header('x-test-role'),
    };
    next();
  },
}));

jest.mock('../repositories/cloudSqlInvoiceRepository', () => ({
  listInvoicesFromCloudSql: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/reconciliationService', () => ({
  runReconciliation: jest.fn().mockResolvedValue({
    data: [],
    summary: {
      total_invoice_amount: 0,
      total_invoice_count: 0,
      total_pending_amount: 0,
      total_paid_amount: 0,
      total_pending_count: 0,
      total_paid_count: 0,
      payment_total_amount: 0,
      payment_count: 0,
      payment_total_pending_amount: 0,
      payment_total_paid_amount: 0,
      payment_pending_count: 0,
      payment_paid_count: 0,
    },
  }),
}));

const app = express();
app.use('/api/invoices', invoiceRoutes);
app.use('/api/financial', financialRoutes);

describe('Sprint 1 P0 financial containment', () => {
  it.each(['doula', 'client'])(
    'denies %s organization-wide invoices and reconciliation',
    async (role) => {
      await request(app)
        .get('/api/invoices')
        .set('x-test-role', role)
        .expect(403);
      await request(app)
        .get('/api/financial/reconciliation')
        .set('x-test-role', role)
        .expect(403);
      await request(app)
        .get('/api/financial/reconciliation/csv')
        .set('x-test-role', role)
        .expect(403);
    }
  );

  it.each(['admin', 'billing'])(
    'allows %s organization-wide financial reads',
    async (role) => {
      await request(app)
        .get('/api/invoices')
        .set('x-test-role', role)
        .expect(200);
      await request(app)
        .get('/api/financial/reconciliation')
        .set('x-test-role', role)
        .expect(200);
      await request(app)
        .get('/api/financial/reconciliation/csv')
        .set('x-test-role', role)
        .expect(200);
    }
  );
});

describe('Sprint 1 P0 account-state enforcement', () => {
  it.each([ROLE.ADMIN, ROLE.BILLING, ROLE.DOULA, ROLE.CLIENT])(
    'denies an inactive %s account',
    (role) => {
      const user = new User({
        id: 'actor-1',
        email: 'actor@example.test',
        firstname: '',
        lastname: '',
        role,
        account_status: 'inactive' as any,
      });
      expect(isAccountActive(user)).toBe(false);
    }
  );

  it('allows active accounts and denies disabled client portals', () => {
    const active = new User({
      id: 'actor-1',
      email: 'actor@example.test',
      firstname: '',
      lastname: '',
      role: ROLE.DOULA,
      account_status: 'approved' as any,
    });
    expect(isAccountActive(active)).toBe(true);
    const client = new User({
      id: 'client-1',
      email: 'client@example.test',
      firstname: '',
      lastname: '',
      role: ROLE.CLIENT,
      account_status: 'approved' as any,
    }) as User & { portal_status?: string };
    client.portal_status = 'disabled';
    expect(isAccountActive(client)).toBe(false);
  });
});

describe('Sprint 1 P0 free-text card containment', () => {
  const validIntake = {
    firstname: 'Test',
    lastname: 'Client',
    email: 'client@example.test',
    phone_number: '2025550100',
    address: '1 Example Ave',
    city: 'Example',
    state: 'DC',
    zip_code: '20001',
    service_needed: 'Labor Support',
    referral_source: 'Google',
    birth_location: 'Hospital',
    birth_hospital: 'Example Hospital',
    payment_method: 'Self-Pay, Sliding Scale Available',
  };

  it.each(['4111 1111 1111 1111', '123', 'Visa ending 1111'])(
    'rejects legacy card free text without echoing it: %s',
    (value) => {
      expect(() =>
        normalizePublicIntakeSubmission({
          ...validIntake,
          self_pay_card_info: value,
        })
      ).toThrow(/self_pay_card_info is deprecated/);
    }
  );
});
