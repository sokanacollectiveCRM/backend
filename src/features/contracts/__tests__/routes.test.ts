import express from 'express';
import request from 'supertest';

import { createAdminContractRoutes } from '../routes/adminContractRoutes';
import { createClientContractRoutes } from '../routes/clientContractRoutes';
import { createSigningRoutes } from '../routes/signingRoutes';

jest.mock('../../../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: `${role}-user`, role, email: `${role}@example.test` };
    return next();
  },
}));

const handler = (body: object) => (_req: any, res: any) => res.json(body);

function contractController() {
  return {
    createDraft: handler({ created: true }),
    getAdmin: handler({ admin: true }),
    send: handler({ sent: true }),
    resend: handler({ resent: true }),
    void: handler({ voided: true }),
    audit: handler({ events: [] }),
    downloadAdmin: handler({ url: 'short-lived' }),
    listMine: handler({ contracts: [] }),
    getMine: handler({ contract: {} }),
    downloadMine: handler({ url: 'short-lived' }),
  } as any;
}

describe('native contract routes', () => {
  it('keeps native mutation and audit routes admin-only', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/contracts', createAdminContractRoutes(contractController()));

    await request(app).post('/api/contracts/drafts').send({}).expect(401);
    await request(app)
      .post('/api/contracts/drafts')
      .set('x-test-role', 'client')
      .send({})
      .expect(403);
    await request(app)
      .post('/api/contracts/drafts')
      .set('x-test-role', 'admin')
      .send({})
      .expect(200, { created: true });
  });

  it('limits client contract routes to authenticated clients', async () => {
    const app = express();
    app.use('/api/clients', createClientContractRoutes(contractController()));

    await request(app).get('/api/clients/me/contracts').expect(401);
    await request(app)
      .get('/api/clients/me/contracts')
      .set('x-test-role', 'admin')
      .expect(403);
    await request(app)
      .get('/api/clients/me/contracts')
      .set('x-test-role', 'client')
      .expect(200, { contracts: [] });
  });

  it('serves invitation routes without a session and prevents referrer caching', async () => {
    const signingController = {
      get: handler({ contractId: 'contract-1' }),
      document: handler({}),
      progress: handler({ saved: true }),
      complete: handler({ status: 'signed' }),
    } as any;
    const app = express();
    app.use('/signing', createSigningRoutes(signingController));

    const response = await request(app)
      .get('/signing/invitation-token')
      .expect(200, { contractId: 'contract-1' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
});
