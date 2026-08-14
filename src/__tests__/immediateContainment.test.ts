import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

import { logger } from '../common/utils/logger';
import {
  SAFE_INTERNAL_ERROR_MESSAGE,
  createSafeRequestLogger,
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';

const SENSITIVE = [
  'password-secret-value',
  'access-token-secret',
  'refresh-token-secret',
  'Bearer authorization-secret',
  'session=private-cookie',
  'oauth-code-secret',
  'signnow-private-field',
  'diagnosis=private-phi',
  'INS-998877',
  'due_date=2030-04-17',
  'provider-raw-payload',
];

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '__tests__' ||
      entry.name === 'dist'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, files);
    } else if (/\.(ts|js)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('PR3 immediate containment', () => {
  it('contains no localhost telemetry endpoint in production source', () => {
    const srcRoot = path.join(__dirname, '..');
    const offenders = walkSourceFiles(srcRoot).filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return (
        content.includes('127.0.0.1:7707') || content.includes('localhost:7707')
      );
    });
    expect(offenders).toEqual([]);
  });

  it('safe client error bodies never include stacks or provider payloads', () => {
    const body = toSafeClientErrorBody();
    expect(body).toEqual({
      success: false,
      error: SAFE_INTERNAL_ERROR_MESSAGE,
      code: 'INTERNAL_ERROR',
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/stack/i);
    SENSITIVE.forEach((value) => expect(serialized).not.toContain(value));
  });

  it('provider failures normalize to safe operational fields only', () => {
    const error = {
      message: SENSITIVE.join(' '),
      stack: 'Error: secret-stack\n    at leak',
      response: {
        status: 502,
        data: {
          errors: [
            { message: 'provider-raw-payload', field: 'signnow-private-field' },
          ],
        },
      },
      config: {
        headers: { Authorization: 'Bearer authorization-secret' },
        data: 'password=password-secret-value&client_secret=abc',
      },
    };

    const safe = toSafeProviderError(
      'signnow',
      'send_invite',
      error,
      'corr_PR3'
    );
    const output = JSON.stringify(safe);
    SENSITIVE.forEach((value) => expect(output).not.toContain(value));
    expect(output).not.toContain('secret-stack');
    expect(safe).toEqual(
      expect.objectContaining({
        service: 'signnow',
        operation: 'send_invite',
        status: 502,
        errorCode: 'PROVIDER_HTTP_502',
        correlationId: 'corr_PR3',
        retryable: true,
      })
    );
  });

  it('production API errors do not include stack traces', async () => {
    const entries: unknown[][] = [];
    const fakeLogger = {
      info: (...args: unknown[]) => entries.push(args),
      error: (...args: unknown[]) => entries.push(args),
    } as any;

    const app = express();
    app.use(express.json());
    app.use(createSafeRequestLogger(fakeLogger));
    app.get('/boom', (_req, res) => {
      const err = new Error('SQL detail: relation phi_clients does not exist');
      (err as Error & { stack?: string }).stack =
        'Error: SQL detail\n    at Controllers.leak (/app/src/controllers/clientController.ts:1:1)';
      logger.error(
        toSafeProviderError('clients', 'request', err),
        'unexpected'
      );
      res.status(500).json(toSafeClientErrorBody());
    });

    const response = await request(app).get('/boom').expect(500);
    expect(response.body).toEqual({
      success: false,
      error: SAFE_INTERNAL_ERROR_MESSAGE,
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /stack|phi_clients|Controllers\.leak/i
    );
  });

  it('HTTP request logging still emits safe operational context', async () => {
    const entries: unknown[][] = [];
    const fakeLogger = {
      info: (...args: unknown[]) => entries.push(args),
    } as any;
    const app = express();
    app.use(express.json());
    app.use(createSafeRequestLogger(fakeLogger));
    app.post('/ok', (_req, res) => {
      res.status(200).json({ success: true, data: { id: 'keep-me' } });
    });

    const response = await request(app)
      .post('/ok')
      .set('authorization', 'Bearer authorization-secret')
      .set('cookie', 'session=private-cookie')
      .set('x-request-id', 'corr_PR3_OK')
      .send({ password: 'password-secret-value', phi: 'diagnosis=private-phi' })
      .expect(200);

    expect(response.body).toEqual({ success: true, data: { id: 'keep-me' } });
    const output = JSON.stringify(entries);
    SENSITIVE.forEach((value) => expect(output).not.toContain(value));
    expect(entries[0][0]).toEqual(
      expect.objectContaining({
        service: 'backend-http',
        correlationId: 'corr_PR3_OK',
        method: 'POST',
        route: '/ok',
        status: 200,
      })
    );
  });
});
