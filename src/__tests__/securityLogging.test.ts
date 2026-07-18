import express from 'express';
import request from 'supertest';

import {
  createSafeRequestLogger,
  installProductionConsoleGuard,
  toSafeProviderError,
} from '../common/utils/safeLogging';

const sensitiveValues = [
  'Jane Client', 'jane@example.test', '2030-04-17', 'INS-998877',
  'birth_preferences=private', 'oauth-code-secret', 'oauth-state-secret',
  'access-token-secret', 'refresh-token-secret',
  'https://payments.example.test/pay/private-link', 'signnow-private-field',
  'Bearer authorization-secret', 'session=private-cookie', 'diagnosis=private-phi',
];

describe('SEC-01-BE safe logging', () => {
  it('HTTP logging emits only allowlisted request metadata', async () => {
    const entries: unknown[][] = [];
    const fakeLogger = { info: (...args: unknown[]) => entries.push(args) } as any;
    const app = express();
    app.use(express.json());
    app.use(createSafeRequestLogger(fakeLogger));
    app.post('/clients/:clientId/contracts', (_req, res) => {
      res.status(202).json({ ok: true });
    });

    await request(app)
      .post('/clients/private-client-id/contracts?oauth-code=oauth-code-secret')
      .set('authorization', 'Bearer authorization-secret')
      .set('cookie', 'session=private-cookie')
      .set('x-request-id', 'corr_SEC01')
      .send({ name: 'Jane Client', email: 'jane@example.test', phi: 'diagnosis=private-phi' })
      .expect(202);

    const output = JSON.stringify(entries);
    sensitiveValues.forEach((value) => expect(output).not.toContain(value));
    expect(entries[0][0]).toEqual(expect.objectContaining({
      service: 'backend-http', correlationId: 'corr_SEC01', method: 'POST',
      route: '/clients/:clientId/contracts', status: 202,
    }));
  });

  it.each([
    ['supabase', 'authenticate', 401],
    ['quickbooks', 'oauth_callback', 502],
    ['signnow', 'send_contract', 429],
    ['stripe', 'create_payment', 503],
  ])('normalizes %s failures without provider payloads', (service, operation, status) => {
    const payload = Object.fromEntries(sensitiveValues.map((value, index) => [`secret${index}`, value]));
    const error = { message: sensitiveValues.join(' '), config: payload, response: { status, data: payload } };
    const safe = toSafeProviderError(service, operation, error, 'corr_SEC01');
    const output = JSON.stringify(safe);

    sensitiveValues.forEach((value) => expect(output).not.toContain(value));
    expect(safe).toEqual(expect.objectContaining({
      service, operation, status, correlationId: 'corr_SEC01',
      errorCode: `PROVIDER_HTTP_${status}`,
    }));
  });

  it('suppresses legacy console arguments in production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug, dir: console.dir };
    try {
      process.env.NODE_ENV = 'production';
      installProductionConsoleGuard();
      sensitiveValues.forEach((value) => console.error(value));
      expect(console.error).not.toBe(originals.error);
    } finally {
      process.env.NODE_ENV = originalEnv;
      Object.assign(console, originals);
    }
  });
});
