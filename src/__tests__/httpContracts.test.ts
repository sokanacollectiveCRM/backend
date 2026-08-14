import express from 'express';
import request from 'supertest';

import {
  authErrorBody,
  canonicalError,
  canonicalOk,
  validationErrorBody,
} from '../common/http/apiEnvelope';
import { validateBody, validateRequest } from '../middleware/validateRequest';
import { ApiErrorCode } from '../security/errorCodes';
import { loginBodySchema } from '../security/requestSchemas';
import {
  DEFAULT_ALIAS_SUNSET,
  deprecateAlias,
  getRouteDeprecationCounters,
  resetRouteDeprecationCountersForTests,
  setDeprecationHeaders,
} from '../security/routeDeprecationTelemetry';
import { z } from 'zod';

describe('PR 7 canonical HTTP envelope', () => {
  it('builds success and error envelopes with stable codes', () => {
    expect(canonicalOk({ id: '1' })).toEqual({ success: true, data: { id: '1' } });
    expect(canonicalError('Nope', ApiErrorCode.FORBIDDEN)).toEqual({
      success: false,
      error: 'Nope',
      code: 'FORBIDDEN',
    });
  });

  it('keeps auth-compatible error strings and adds codes', () => {
    expect(authErrorBody('No session token provided', ApiErrorCode.UNAUTHENTICATED, {
      hint: 'Provide Cookie or X-Session-Token header',
    })).toEqual({
      error: 'No session token provided',
      code: 'UNAUTHENTICATED',
      hint: 'Provide Cookie or X-Session-Token header',
    });
  });

  it('validation body always includes string error for FE parsers', () => {
    const body = validationErrorBody('Valid email is required', [{ path: 'email' }]);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(typeof body.error).toBe('string');
  });
});

describe('PR 7 Zod validateRequest', () => {
  it('rejects invalid login bodies with VALIDATION_ERROR', async () => {
    const app = express();
    app.use(express.json());
    app.post('/auth/login', validateBody(loginBodySchema), (_req, res) => {
      res.status(200).json({ message: 'Login successful' });
    });

    const res = await request(app).post('/auth/login').send({ email: 'not-an-email' }).expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.error).toMatch(/email|password|required/i);
  });

  it('accepts valid login bodies and preserves handler success shape', async () => {
    const app = express();
    app.use(express.json());
    app.post('/auth/login', validateBody(loginBodySchema), (req, res) => {
      res.status(200).json({
        message: 'Login successful',
        user: { email: req.body.email },
        token: 'tok',
      });
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'secret' })
      .expect(200);
    expect(res.body).toEqual({
      message: 'Login successful',
      user: { email: 'a@example.com' },
      token: 'tok',
    });
  });

  it('validates params via parts object', async () => {
    const app = express();
    app.get(
      '/items/:id',
      validateRequest({
        params: z.object({ id: z.string().uuid() }),
      }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await request(app).get('/items/not-a-uuid').expect(400);
    await request(app).get('/items/11111111-1111-1111-1111-111111111111').expect(200);
  });
});

describe('PR 7 alias deprecation', () => {
  beforeEach(() => {
    resetRouteDeprecationCountersForTests();
  });

  it('sets Deprecation / Sunset / Link headers and records telemetry', async () => {
    const app = express();
    app.post(
      '/login',
      deprecateAlias({ aliasKey: 'alias.login', successorPath: '/auth/login' }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    const res = await request(app).post('/login').expect(200);
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBe(DEFAULT_ALIAS_SUNSET);
    expect(res.headers.link).toContain('/auth/login');
    expect(res.body).toEqual({ ok: true });
    expect(getRouteDeprecationCounters()['alias.login']).toBe(1);
  });

  it('setDeprecationHeaders alone does not alter JSON', () => {
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
    };
    setDeprecationHeaders(res, { successorPath: '/clients' });
    expect(headers.deprecation).toBe('true');
    expect(headers.link).toContain('/clients');
  });
});
