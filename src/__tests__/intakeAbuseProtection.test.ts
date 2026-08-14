import express from 'express';
import request from 'supertest';

import { PUBLIC_INTAKE_SUCCESS_MESSAGE } from '../features/intake';
import {
  MemoryIntakeAbuseStore,
  buildSoftDedupeKey,
  evaluateIntakeSubmissionGuards,
  finalizeIntakeIdempotency,
  isIntakeHoneypotTriggered,
  protectPublicIntakeEarly,
  resetIntakeAbuseStoreForTests,
  setIntakeAbuseStoreForTests,
} from '../features/intake/infrastructure/intakeAbuseProtection';

describe('intake abuse protection', () => {
  beforeEach(() => {
    const memory = new MemoryIntakeAbuseStore();
    setIntakeAbuseStoreForTests(memory);
    process.env.INTAKE_ABUSE_ENFORCE = 'true';
    process.env.INTAKE_RATE_LIMIT_IP_MAX = '2';
    process.env.INTAKE_RATE_LIMIT_EMAIL_MAX = '2';
    process.env.INTAKE_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.INTAKE_SOFT_DEDUPE_WINDOW_MS = '60000';
    process.env.INTAKE_IDEMPOTENCY_TTL_MS = '60000';
  });

  afterEach(() => {
    resetIntakeAbuseStoreForTests();
    delete process.env.INTAKE_ABUSE_ENFORCE;
    delete process.env.INTAKE_RATE_LIMIT_IP_MAX;
    delete process.env.INTAKE_RATE_LIMIT_EMAIL_MAX;
    delete process.env.INTAKE_RATE_LIMIT_WINDOW_MS;
    delete process.env.INTAKE_SOFT_DEDUPE_WINDOW_MS;
    delete process.env.INTAKE_IDEMPOTENCY_TTL_MS;
  });

  it('detects honeypot fields', () => {
    expect(isIntakeHoneypotTriggered({ website: 'http://spam.test' })).toBe(
      true
    );
    expect(isIntakeHoneypotTriggered({ firstname: 'Ada' })).toBe(false);
  });

  it('returns fake success for honeypot submissions', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/requestService/requestSubmission',
      protectPublicIntakeEarly,
      (_req, res) => {
        res.status(200).json({ message: 'should-not-reach' });
      }
    );

    const res = await request(app)
      .post('/requestService/requestSubmission')
      .send({ website: 'bot', email: 'a@b.c' })
      .expect(200);
    expect(res.body).toEqual({ message: PUBLIC_INTAKE_SUCCESS_MESSAGE });
  });

  it('rate limits by IP', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/requestService/requestSubmission',
      protectPublicIntakeEarly,
      (_req, res) => {
        res.status(200).json({ ok: true });
      }
    );

    await request(app)
      .post('/requestService/requestSubmission')
      .send({ email: 'a@b.c' })
      .expect(200);
    await request(app)
      .post('/requestService/requestSubmission')
      .send({ email: 'a@b.c' })
      .expect(200);
    const limited = await request(app)
      .post('/requestService/requestSubmission')
      .send({ email: 'a@b.c' })
      .expect(429);
    expect(limited.body.error).toMatch(/Too many requests/i);
    expect(limited.body.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeTruthy();
  });

  it('replays Idempotency-Key responses and soft-dedupes email fingerprints', async () => {
    const body = {
      email: 'ada@example.com',
      firstname: 'Ada',
      lastname: 'Lovelace',
      service_needed: 'Labor Support',
    };

    const req1: any = {
      headers: { 'idempotency-key': 'key-1' },
      get: (name: string) =>
        name.toLowerCase() === 'idempotency-key' ? 'key-1' : undefined,
    };
    expect(await evaluateIntakeSubmissionGuards(req1, body)).toEqual({
      action: 'proceed',
    });
    await finalizeIntakeIdempotency(req1, body, 200, {
      message: PUBLIC_INTAKE_SUCCESS_MESSAGE,
    });

    const replay = await evaluateIntakeSubmissionGuards(req1, body);
    expect(replay).toEqual({
      action: 'replay',
      status: 200,
      body: { message: PUBLIC_INTAKE_SUCCESS_MESSAGE },
    });

    const softReq: any = { headers: {}, get: () => undefined };
    const soft = await evaluateIntakeSubmissionGuards(softReq, body);
    expect(soft).toEqual({ action: 'soft_dedupe' });
    expect(buildSoftDedupeKey(body)).toMatch(/^soft:/);
  });

  it('rate limits by email after threshold', async () => {
    const body = {
      email: 'limit@example.com',
      firstname: 'A',
      lastname: 'B',
      service_needed: 'Labor Support',
    };
    const req: any = { headers: {}, get: () => undefined };
    expect(await evaluateIntakeSubmissionGuards(req, body)).toEqual({
      action: 'proceed',
    });
    expect(
      await evaluateIntakeSubmissionGuards(req, { ...body, firstname: 'C' })
    ).toEqual({
      action: 'proceed',
    });
    const limited = await evaluateIntakeSubmissionGuards(req, {
      ...body,
      firstname: 'D',
    });
    expect(limited.action).toBe('rate_limited');
  });
});
