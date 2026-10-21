import { devVisitPreviewAllowed } from '../application/devVisitPreview';
import { runVisitReminders } from '../application/runVisitReminders';
import {
  VisitReminderCandidate,
  visitReminderKey,
  visitReminderRules,
} from '../domain/visitReminders';
import {
  NotificationEmail,
  buildVisitReminderEmail,
} from '../infrastructure/notificationEmail';
import { NotificationStore } from '../infrastructure/notificationStore';

const row: VisitReminderCandidate = {
  bookingId: 'booking',
  tenantId: 'tenant',
  clientId: 'client',
  doulaId: 'doula',
  startAt: new Date('2026-10-21T15:00:00Z'),
  createdAt: new Date('2026-10-19T15:00:00Z'),
  status: 'approved',
  postponed: false,
  timeZone: 'America/Chicago',
  clientEmail: 'jerry+client@example.com',
  clientFirstName: 'Maya',
  doulaEmail: 'jerry+doula@example.com',
  doulaFirstName: 'Jordan',
};
describe('visit reminder windows', () => {
  it('opens at 24 hours and closes at visit start', () => {
    expect(visitReminderRules(row, new Date('2026-10-20T14:59:59Z'))).toEqual(
      []
    );
    expect(visitReminderRules(row, new Date('2026-10-20T15:00:00Z'))).toEqual([
      'visit_reminder_24h',
    ]);
    expect(visitReminderRules(row, row.startAt)).toEqual([]);
  });
  it('opens morning at 7 Chicago and skips late-booked 24h reminders', () => {
    const late = { ...row, createdAt: new Date('2026-10-20T17:00:00Z') };
    expect(visitReminderRules(late, new Date('2026-10-21T11:59:59Z'))).toEqual(
      []
    );
    expect(visitReminderRules(late, new Date('2026-10-21T12:00:00Z'))).toEqual([
      'visit_reminder_morning',
    ]);
  });
  it('does not send morning reminders for visits before 7', () => {
    const early = { ...row, startAt: new Date('2026-10-21T11:30:00Z') };
    expect(visitReminderRules(early, new Date('2026-10-21T11:00:00Z'))).toEqual(
      ['visit_reminder_24h']
    );
    expect(visitReminderRules(early, new Date('2026-10-21T12:00:00Z'))).toEqual(
      []
    );
  });
  it.each([
    ['2026-03-08T15:00:00Z', '2026-03-08T12:00:00Z'],
    ['2026-11-01T16:00:00Z', '2026-11-01T13:00:00Z'],
  ])('uses Chicago local morning over DST at %s', (start, now) => {
    const candidate = {
      ...row,
      startAt: new Date(start),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    expect(visitReminderRules(candidate, new Date(now))).toContain(
      'visit_reminder_morning'
    );
    expect(
      visitReminderRules(candidate, new Date(new Date(now).getTime() - 1))
    ).not.toContain('visit_reminder_morning');
  });
  it('uses a new key on reschedule and separate recipient keys', () => {
    const key = visitReminderKey(row, 'visit_reminder_24h', 'client');
    expect(
      visitReminderKey(
        { ...row, startAt: new Date('2026-10-22T15:00:00Z') },
        'visit_reminder_24h',
        'client'
      )
    ).not.toBe(key);
    expect(visitReminderKey(row, 'visit_reminder_24h', 'doula')).not.toBe(key);
  });
  it.each([
    { ...row, status: 'cancelled' },
    { ...row, postponed: true },
  ])('stops cancelled or postponed visits', (candidate) => {
    expect(
      visitReminderRules(candidate, new Date('2026-10-20T15:00:00Z'))
    ).toEqual([]);
  });
  it('honors kill switch', () => {
    expect(
      visitReminderRules(row, new Date('2026-10-20T15:00:00Z'), true)
    ).toEqual([]);
  });
  it('produces minimal escaped messages and a CRM link', () => {
    const mail = buildVisitReminderEmail(
      { ...row, doulaFirstName: '<Jordan>' },
      'client',
      new Date('2026-10-20T15:00:00Z')
    );
    expect(mail.subject).toContain('tomorrow at 10:00 AM CDT');
    expect(mail.html).toContain('&lt;Jordan&gt;');
    expect(mail.html).not.toContain('<Jordan>');
    expect(mail.text).toContain('hello@sokanacollective.com');
    process.env.FRONTEND_URL = 'https://dev.example.com';
    expect(
      buildVisitReminderEmail(row, 'doula', new Date('2026-10-21T12:00:00Z'))
        .text
    ).toContain('https://dev.example.com/admin/clients/client');
  });
});
describe('visit tick delivery integration', () => {
  const claimed = new Set<string>();
  let fresh: VisitReminderCandidate[];
  let killed: boolean;
  const mail = { sendVisitReminder: jest.fn() };
  const store = {
    isKilled: jest.fn(async () => killed),
    listVisitCandidates: jest.fn(async () => fresh),
    claimVisit: jest.fn(async ({ dedupeKey }: { dedupeKey: string }) => {
      if (claimed.has(dedupeKey)) return false;
      claimed.add(dedupeKey);
      return true;
    }),
    releaseClaim: jest.fn(async (key: string) => {
      claimed.delete(key);
    }),
    markDelivery: jest.fn(),
  };
  const tick = (now: string) =>
    runVisitReminders(
      new Date(now),
      store as unknown as NotificationStore,
      mail as unknown as NotificationEmail
    );
  beforeEach(() => {
    jest.clearAllMocks();
    claimed.clear();
    fresh = [row];
    killed = false;
    mail.sendVisitReminder.mockResolvedValue(undefined);
  });
  it('sends two deliveries for each rule, with no duplicates across repeated concurrent ticks', async () => {
    await Promise.all([
      tick('2026-10-20T15:00:00Z'),
      tick('2026-10-20T15:00:00Z'),
    ]);
    expect(mail.sendVisitReminder).toHaveBeenCalledTimes(2);
    await tick('2026-10-21T12:00:00Z');
    await tick('2026-10-21T12:00:00Z');
    expect(mail.sendVisitReminder).toHaveBeenCalledTimes(4);
    expect(claimed.size).toBe(4);
  });
  it.each(['cancel', 'reschedule', 'postpone', 'kill'])(
    'rechecks %s after claiming and before sending',
    async (condition) => {
      store.claimVisit.mockImplementationOnce(async () => {
        if (condition === 'cancel') fresh = [];
        if (condition === 'reschedule')
          fresh = [{ ...row, startAt: new Date('2026-10-22T15:00:00Z') }];
        if (condition === 'postpone') fresh = [{ ...row, postponed: true }];
        if (condition === 'kill') killed = true;
        return true;
      });
      await tick('2026-10-20T15:00:00Z');
      expect(mail.sendVisitReminder).not.toHaveBeenCalled();
    }
  );
  it('does not resend after an ambiguous SMTP failure', async () => {
    mail.sendVisitReminder.mockRejectedValue(new Error('SMTP disconnected'));
    await tick('2026-10-20T15:00:00Z');
    await tick('2026-10-20T15:00:00Z');
    expect(mail.sendVisitReminder).toHaveBeenCalledTimes(2);
    expect(store.markDelivery).toHaveBeenCalledWith(
      expect.any(String),
      'failed'
    );
  });
});

describe('dev preview guard', () => {
  it('requires exact dev service, database, and explicitly configured tenant', () => {
    const env = {
      K_SERVICE: 'sokana-private-api-dev',
      CLOUD_SQL_DATABASE: 'sokana_private_dev',
      NOTIFICATION_DEV_TEST_TENANT_ID: 'fictional',
    };
    expect(devVisitPreviewAllowed('fictional', env)).toBe(true);
    expect(devVisitPreviewAllowed('real-tenant', env)).toBe(false);
    expect(
      devVisitPreviewAllowed('fictional', {
        ...env,
        K_SERVICE: 'sokana-private-api',
      })
    ).toBe(false);
    expect(
      devVisitPreviewAllowed('fictional', {
        ...env,
        CLOUD_SQL_DATABASE: 'sokana_private',
      })
    ).toBe(false);
    expect(devVisitPreviewAllowed(undefined, {})).toBe(false);
  });
});
