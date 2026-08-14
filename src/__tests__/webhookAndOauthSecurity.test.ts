import {
  hmacSha256Base64,
  hmacSha256Hex,
  isWebhookTimestampFresh,
  verifyIntuitSignature,
  verifySignNowSignature,
} from '../security/webhookCrypto';
import {
  MemoryOAuthStateStore,
  createOAuthState,
  consumeOAuthState,
  setOAuthStateStoreForTests,
  resetOAuthStateStoreForTests,
  OAUTH_STATE_TTL_MS,
} from '../security/oauthStateStore';
import {
  MemoryWebhookEventStore,
  claimWebhookEvent,
  setWebhookEventStoreForTests,
  resetWebhookEventStoreForTests,
} from '../security/webhookEventStore';
import { requireQuickBooksWebhookAuth, requireSignNowWebhookAuth } from '../security/webhookAuth';

describe('PR 5 webhook crypto', () => {
  const payload = Buffer.from('{"hello":"world"}', 'utf8');
  const secret = 'test-secret-key';

  it('verifies Intuit base64 HMAC signatures', () => {
    const signature = hmacSha256Base64(secret, payload);
    expect(verifyIntuitSignature(payload, signature, secret)).toBe(true);
    expect(verifyIntuitSignature(payload, 'bogus', secret)).toBe(false);
    expect(verifyIntuitSignature(payload, signature, 'other')).toBe(false);
  });

  it('verifies SignNow base64 or hex HMAC signatures', () => {
    expect(verifySignNowSignature(payload, hmacSha256Base64(secret, payload), secret)).toBe(true);
    expect(verifySignNowSignature(payload, hmacSha256Hex(secret, payload), secret)).toBe(true);
    expect(verifySignNowSignature(payload, 'nope', secret)).toBe(false);
  });

  it('rejects stale intuit-created-time timestamps', () => {
    const now = Date.parse('2026-08-14T12:00:00.000Z');
    expect(isWebhookTimestampFresh(new Date(now - 60_000).toISOString(), 15 * 60_000, now)).toBe(
      true,
    );
    expect(
      isWebhookTimestampFresh(new Date(now - 20 * 60_000).toISOString(), 15 * 60_000, now),
    ).toBe(false);
    expect(isWebhookTimestampFresh(undefined, 15 * 60_000, now)).toBe(true);
  });
});

describe('PR 5 webhook event idempotency', () => {
  beforeEach(() => {
    const memory = new MemoryWebhookEventStore();
    setWebhookEventStoreForTests(memory);
  });

  afterEach(() => {
    resetWebhookEventStoreForTests();
  });

  it('claims once and treats replays as duplicates', async () => {
    expect(await claimWebhookEvent('signnow', 'signnow:doc-1:document.completed')).toBe('claimed');
    expect(await claimWebhookEvent('signnow', 'signnow:doc-1:document.completed')).toBe(
      'duplicate',
    );
    expect(await claimWebhookEvent('quickbooks', 'qbo:invoice:99:paid')).toBe('claimed');
  });
});

describe('PR 5 OAuth state store', () => {
  beforeEach(() => {
    setOAuthStateStoreForTests(new MemoryOAuthStateStore());
  });

  afterEach(() => {
    resetOAuthStateStoreForTests();
  });

  it('creates cryptographically random single-use states', async () => {
    const a = await createOAuthState();
    const b = await createOAuthState();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(await consumeOAuthState(a)).toBe(true);
    expect(await consumeOAuthState(a)).toBe(false);
    expect(await consumeOAuthState('missing')).toBe(false);
  });

  it('rejects expired states', async () => {
    const store = new MemoryOAuthStateStore();
    setOAuthStateStoreForTests(store);
    const state = await createOAuthState('quickbooks', 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await consumeOAuthState(state)).toBe(false);
    expect(OAUTH_STATE_TTL_MS).toBeGreaterThan(0);
  });
});

describe('PR 5 webhook auth middleware', () => {
  const createRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const keys = [
    'SIGNNOW_WEBHOOK_SECRET',
    'SIGNNOW_BASIC_AUTH_TOKEN',
    'QB_WEBHOOK_VERIFIER_TOKEN',
    'INTUIT_WEBHOOK_VERIFIER_TOKEN',
  ] as const;
  const saved: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it('rejects SignNow callbacks with bad signatures when secret is set', () => {
    process.env.SIGNNOW_WEBHOOK_SECRET = 'sn-secret';
    const body = Buffer.from('{"document_id":"d1","event":"document.completed"}');
    const req: any = {
      rawBody: body,
      get: (name: string) => (name.toLowerCase() === 'x-signnow-signature' ? 'invalid' : undefined),
      headers: { 'x-signnow-signature': 'invalid' },
    };
    const res = createRes();
    const next = jest.fn();
    requireSignNowWebhookAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts SignNow callbacks with valid HMAC', () => {
    process.env.SIGNNOW_WEBHOOK_SECRET = 'sn-secret';
    const body = Buffer.from('{"document_id":"d1","event":"document.completed"}');
    const signature = hmacSha256Base64('sn-secret', body);
    const req: any = {
      rawBody: body,
      get: (name: string) =>
        name.toLowerCase() === 'x-signnow-signature' ? signature : undefined,
      headers: { 'x-signnow-signature': signature },
    };
    const res = createRes();
    const next = jest.fn();
    requireSignNowWebhookAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects QuickBooks webhooks with invalid intuit-signature when verifier is set', () => {
    process.env.QB_WEBHOOK_VERIFIER_TOKEN = 'qb-verifier';
    const body = Buffer.from('{"Id":"inv-1","Balance":0}');
    const req: any = {
      rawBody: body,
      get: () => undefined,
      headers: {},
    };
    const res = createRes();
    const next = jest.fn();
    requireQuickBooksWebhookAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts QuickBooks webhooks with valid intuit-signature', () => {
    process.env.QB_WEBHOOK_VERIFIER_TOKEN = 'qb-verifier';
    const body = Buffer.from('{"Id":"inv-1","Balance":0}');
    const signature = hmacSha256Base64('qb-verifier', body);
    const req: any = {
      rawBody: body,
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'intuit-signature') return signature;
        if (key === 'intuit-created-time') return new Date().toISOString();
        return undefined;
      },
      headers: {
        'intuit-signature': signature,
        'intuit-created-time': new Date().toISOString(),
      },
    };
    const res = createRes();
    const next = jest.fn();
    requireQuickBooksWebhookAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
