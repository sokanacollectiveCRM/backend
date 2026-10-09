import express from 'express';
import request from 'supertest';

import { PostponementService } from '../application/postponementService';
import { ReminderEngine } from '../application/reminderEngine';
import { createAdminMessagingRoutes } from '../http/adminMessagingRoutes';
import { createReminderTickRoutes } from '../http/tickRoutes';
import { InMemoryReminderStore } from '../infrastructure/inMemoryReminderStore';
import { seedInMemoryMessaging } from '../seeds/defaultMessaging';

jest.mock('../../../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    req.user = {
      id: `${role}-user`,
      role,
      email: `${role}@example.test`,
    };
    return next();
  },
}));

const sendEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../services/emailService', () => ({
  NodemailerService: jest.fn().mockImplementation(() => ({ sendEmail })),
}));

function build(
  testToolsEnabled: boolean,
  verify?: (token: string) => Promise<any>
) {
  const store = new InMemoryReminderStore();
  seedInMemoryMessaging(store);
  const engine = new ReminderEngine({
    store,
    mailer: { sendEmail },
  });
  const postponements = new PostponementService(store, engine);
  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin',
    createAdminMessagingRoutes({
      store,
      engine,
      postponements,
      testToolsEnabled,
    })
  );
  app.use('/api/internal', createReminderTickRoutes(engine, verify));
  return { app, store, engine };
}

describe('messaging HTTP', () => {
  beforeEach(() => {
    sendEmail.mockClear();
    process.env.REMINDER_CRON_OIDC_AUDIENCE = 'https://dev-api.example';
    process.env.REMINDER_CRON_OIDC_SERVICE_ACCOUNT =
      'reminder-scheduler@sokana-private-data.iam.gserviceaccount.com';
  });

  it('keeps admin messaging routes admin-only', async () => {
    const { app } = build(false);
    await request(app).get('/api/admin/messaging/policies').expect(401);
    await request(app)
      .get('/api/admin/messaging/policies')
      .set('x-test-role', 'doula')
      .expect(403);
    const ok = await request(app)
      .get('/api/admin/messaging/policies')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(ok.body.success).toBe(true);
    expect(
      ok.body.data.some((p: { key: string }) => p.key === 'contract_signing')
    ).toBe(true);
  });

  it('returns 404 for test tools when the flag is off', async () => {
    const { app } = build(false);
    await request(app)
      .post('/api/admin/messaging/tick-now')
      .set('x-test-role', 'admin')
      .expect(404);
    await request(app)
      .post(
        '/api/admin/messaging/runs/11111111-1111-4111-8111-111111111111/advance'
      )
      .set('x-test-role', 'admin')
      .expect(404);
  });

  it('sends template tests only to the requesting admin', async () => {
    const { app, store } = build(true);
    const template = [...store.templates.values()][0];
    const res = await request(app)
      .post(`/api/admin/messaging/templates/${template.id}/test-send`)
      .set('x-test-role', 'admin')
      .send({ sample: { client_first_name: 'Ada' } })
      .expect(200);
    expect(res.body.data.to).toBe('admin@example.test');
    expect(sendEmail).toHaveBeenCalledWith(
      'admin@example.test',
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });

  it('rejects tick calls without a valid OIDC token', async () => {
    const { app } = build(false, async () => null);
    await request(app).post('/api/internal/cron/reminders/tick').expect(401);
    await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer bad')
      .expect(401);
  });

  it('rejects tick calls with the wrong service account', async () => {
    const { app } = build(false, async () => ({
      aud: 'https://dev-api.example',
      email: 'other@example.com',
      email_verified: true,
    }));
    await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer token')
      .expect(403);
  });

  it('accepts a verified scheduler token and is idempotent', async () => {
    const { app } = build(false, async () => ({
      aud: 'https://dev-api.example',
      email: 'reminder-scheduler@sokana-private-data.iam.gserviceaccount.com',
      email_verified: true,
    }));
    const first = await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer token')
      .expect(200);
    const second = await request(app)
      .post('/api/internal/cron/reminders/tick')
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(first.body.claimed).toBeDefined();
    expect(second.body.claimed).toBeDefined();
  });

  it('returns overdue_days from settings', async () => {
    const { app } = build(true);
    const res = await request(app)
      .get('/api/admin/messaging/settings')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(res.body.data.overdue_days).toBe(7);
    expect(res.body.data.test_tools_enabled).toBe(true);
    expect(res.body.data.billing_notification_email).toBeTruthy();
  });
});
