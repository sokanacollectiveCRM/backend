import cors from 'cors';
import express from 'express';
import request from 'supertest';

import { CORS_ALLOWED_HEADERS, createCorsOptions } from '../config/corsConfig';
import { RequestFormController } from '../controllers/requestFormController';
import { normalizePublicIntakeSubmission } from '../features/intake/domain/normalizePublicSubmission';
import { RequestFormRepository } from '../repositories/requestFormRepository';
import { RequestFormService } from '../services/RequestFormService';

const DEV_FRONTEND_ORIGIN =
  'https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app';

const nancyPayload = {
  firstname: 'Nancy',
  lastname: 'Cowans',
  email: 'nancy@example.com',
  phone_number: '312-555-0100',
  city: 'Chicago',
  zip_code: '60614',
  due_date: '2027-01-15',
  services_interested: ['Labor Support'],
  service_needed: 'Labor Support',
  service_support_details: 'I want a doula for labor support.',
};

const mockQuery = jest.fn();
jest.mock('../db/cloudSqlPool', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery,
  })),
}));

describe('Nancy public intake required-field set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a minimal Nancy-only payload', () => {
    const normalized = normalizePublicIntakeSubmission(nancyPayload);
    expect(normalized.firstname).toBe('Nancy');
    expect(normalized.city).toBe('Chicago');
    expect(normalized.zip_code).toBe('60614');
    expect(normalized.service_needed).toBe('Labor Support');
    expect(normalized.service_support_details).toBe(
      'I want a doula for labor support.'
    );
    expect(normalized.address).toBeUndefined();
    expect(normalized.state).toBeUndefined();
    expect(normalized.intake_age_years).toBeUndefined();
    expect(normalized.payment_method).toBeUndefined();
    expect(normalized.referral_source).toBeUndefined();
    expect(normalized.provider_type).toBeUndefined();
  });

  it('derives client_age_range from optional age and persists primary_language_other', () => {
    const normalized = normalizePublicIntakeSubmission({
      ...nancyPayload,
      age: 28,
      primary_language: 'Other',
      primary_language_other: 'Yoruba',
    });
    expect(normalized.intake_age_years).toBe(28);
    expect(normalized.client_age_range).toBe('26-35');
    expect(normalized.primary_language).toBe('Yoruba');
    expect(normalized.primary_language_other).toBe('Yoruba');
  });

  it('inserts a Nancy-only payload with nulls for optional columns', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_number: 'CL-00099' }],
    });
    const repository = new RequestFormRepository({} as any);
    const normalized = normalizePublicIntakeSubmission(nancyPayload);
    const saved = await repository.saveData(normalized);

    expect(saved.firstname).toBe('Nancy');
    expect(saved.client_number).toBe('CL-00099');
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO phi_clients');
    expect(sql).toContain('primary_language_other');
    expect(params[1]).toBe('Nancy');
    expect(params[2]).toBe('Cowans');
    expect(params[5]).toBeNull();
    expect(params[6]).toBe('Chicago');
    expect(params[7]).toBeNull();
    expect(params[8]).toBe('60614');
  });

  it('returns 400 naming missing required fields', async () => {
    const repository = new RequestFormRepository({} as any);
    const service = new RequestFormService(repository);
    const controller = new RequestFormController(service);
    const app = express();
    app.use(express.json());
    app.post('/requestService/requestSubmission', (req, res) =>
      controller.createForm(req, res)
    );

    const response = await request(app)
      .post('/requestService/requestSubmission')
      .send({ firstname: 'Nancy' })
      .expect(400);

    expect(response.body.error).toMatch(/Missing required fields:/);
    expect(response.body.error).toMatch(/lastname/);
    expect(response.body.error).toMatch(/email/);
    expect(response.body.error).toMatch(/phone_number/);
    expect(response.body.error).toMatch(/city/);
    expect(response.body.error).toMatch(/zip_code/);
    expect(response.body.error).toMatch(/due_date/);
    expect(response.body.error).toMatch(/service_needed/);
    expect(response.body.error).toMatch(/service_support_details/);
  });

  it('requires primary_language_other when language is Other', () => {
    expect(() =>
      normalizePublicIntakeSubmission({
        ...nancyPayload,
        primary_language: 'Other',
        primary_language_other: '',
      })
    ).toThrow(/primary_language_other/);
  });
});

describe('CORS public intake preflight', () => {
  it('allowlists Idempotency-Key', () => {
    expect(CORS_ALLOWED_HEADERS).toEqual(
      expect.arrayContaining(['Idempotency-Key'])
    );
  });

  it('allows Idempotency-Key from the dev frontend origin', async () => {
    const app = express();
    app.use(cors(createCorsOptions(new Set([DEV_FRONTEND_ORIGIN]))));
    app.post('/requestService/sokana360/requestSubmission', (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .options('/requestService/sokana360/requestSubmission')
      .set('Origin', DEV_FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
      .expect(204);

    const allowHeaders = String(
      response.headers['access-control-allow-headers'] || ''
    ).toLowerCase();
    expect(allowHeaders).toContain('idempotency-key');
    expect(response.headers['access-control-allow-origin']).toBe(
      DEV_FRONTEND_ORIGIN
    );
  });
});
