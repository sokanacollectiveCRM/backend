import express from 'express';
import request from 'supertest';

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }
    req.user = { id: 'synthetic-user', email: 'synthetic@example.test', role };
    next();
  },
}));

jest.mock('../utils/pdfContractProcessor', () => ({
  getAvailableContractTemplates: jest.fn(() => ['labor_support_v1']),
  processContractWithPdfTemplate: jest.fn(),
  validateContractDataForTemplate: jest.fn(() => ({ valid: true, missingFields: [] })),
}));

import pdfContractRoutes from '../routes/pdfContractRoutes';

describe('PDF contract authorization and credential containment', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/pdf-contract', pdfContractRoutes);

  it('rejects unauthenticated operational requests', async () => {
    await request(app).post('/api/pdf-contract/process').send({}).expect(401);
  });

  it('rejects authenticated non-admin users', async () => {
    await request(app)
      .post('/api/pdf-contract/process')
      .set('x-test-role', 'client')
      .send({})
      .expect(403);
  });

  it('allows an admin to reach request validation', async () => {
    await request(app)
      .post('/api/pdf-contract/process')
      .set('x-test-role', 'admin')
      .send({})
      .expect(400);
  });

  it('contains no embedded SignNow access-token literal', () => {
    const source = require('node:fs').readFileSync(
      require.resolve('../routes/pdfContractRoutes'),
      'utf8'
    );
    expect(source).toContain('SIGNNOW_ACCESS_TOKEN');
    expect(source).not.toMatch(/["'][A-Za-z0-9._-]{40,}["']/);
  });
});
