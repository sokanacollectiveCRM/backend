import express from 'express';
import request from 'supertest';

import { loadDefaultSeed } from '../application/seedDefaults';
import { PostponementService } from '../application/postponementService';
import { ReminderEngine } from '../application/reminderEngine';
import { MessagingController } from '../http/messagingController';
import {
  createAdminMessagingRoutes,
  createReminderTickRoutes,
} from '../http/messagingRoutes';
import { InMemoryMessagingStore } from '../testSupport/inMemoryStore';

jest.mock('../../../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    req.user = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role,
      email: `${role}@example.test`,
    };
    return next();
  },
}));

jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken,
    })),
    __verifyIdToken: verifyIdToken,
  };
});

const { __verifyIdToken: verifyIdToken } = jest.requireMock(
  'google-auth-library'
) as { __verifyIdToken: jest.Mock };

describe('messaging HTTP', () => {
  const sent: Array<{ to: string; subject: string }> = [];
  let store: InMemoryMessagingStore;
  let app: express.Express;

  beforeEach(async () => {
    store = new InMemoryMessagingStore();
    await loadDefaultSeed(store);
    sent.length = 0;
    verifyIdToken.mockReset();
    process.env.REMINDER_CRON_OIDC_AUDIENCE = 'https://dev.example';
    process.env.REMINDER_CRON_OIDC_SERVICE_ACCOUNT =
      'reminder-scheduler@sokana-private-data.iam.gserviceaccount.com';
    process.env.REMINDER_TEST_TOOLS_ENABLED = 'false';
    const engine = new ReminderEngine(
      store,
      {
        sendEmail: async (to, subject) => {
          sent.push({ to, subject });
        },
      },
      { voidIfUnsigned: async () => 'voided' },
      { issue: async () => null }
    );
    const controller = new MessagingController(
      store,
      engine,
      new PostponementService(store, engine),
      {
        sendEmail: async (to, subject) => {
          sent.push({ to, subject });
        },
      }
    );
    app = express();
    app.use(express.json());
    app.use('/api/admin', createAdminMessagingRoutes(controller));
    app.use('/api/internal/cron/reminders', createReminderTickRoutes(controller));
  });

  it('rejects the tick without a valid OIDC token', async () => {
    await request(app)
      .post('/api/internal/cron/reminders/tick')
      .expect(401);
    verifyIdToken.mockRejectedValue(new Error('bad token'));
    await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
  });

  it('rejects a valid token from the wrong service account', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'other@example.com',
        email_verified: true,
      }),
    });
    await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer good')
      .expect(403);
  });

  it('accepts a verified scheduler token', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'reminder-scheduler@sokana-private-data.iam.gserviceaccount.com',
        email_verified: true,
      }),
    });
    const res = await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer good')
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ claimed: 0, sent: 0 })
    );
  });

  it('returns 404 for test tools when the flag is off', async () => {
    process.env.REMINDER_TEST_TOOLS_ENABLED = 'false';
    await request(app)
      .post('/api/admin/messaging/tick-now')
      .set('x-test-role', 'admin')
      .expect(404);
    await request(app)
      .post('/api/admin/messaging/runs/11111111-1111-4111-8111-111111111111/advance')
      .set('x-test-role', 'admin')
      .expect(404);
  });

  it('sends test-send only to the requesting admin', async () => {
    const template = store.templates[0];
    const res = await request(app)
      .post(`/api/admin/messaging/templates/${template.id}/test-send`)
      .set('x-test-role', 'admin')
      .send({ sample: { client_first_name: 'Ada' } })
      .expect(200);
    expect(res.body.data.sentTo).toBe('admin@example.test');
    expect(sent).toEqual([
      expect.objectContaining({ to: 'admin@example.test' }),
    ]);
  });

  it('keeps messaging admin-only', async () => {
    await request(app).get('/api/admin/messaging/policies').expect(401);
    await request(app)
      .get('/api/admin/messaging/policies')
      .set('x-test-role', 'doula')
      .expect(403);
    const res = await request(app)
      .get('/api/admin/messaging/policies')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((p: { key: string }) => p.key === 'deposit_payment')).toBe(
      false
    );
  });

  it('returns overdue_days on settings', async () => {
    const res = await request(app)
      .get('/api/admin/messaging/settings')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(res.body.data.overdue_days).toBe(7);
    expect(res.body.data.contactEmail).toBe('hello@sokanacollective.com');
  });
});
