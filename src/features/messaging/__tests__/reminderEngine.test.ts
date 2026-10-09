import { addDelay } from '../domain/delay';
import { ReminderEngine } from '../application/reminderEngine';
import { loadDefaultSeed } from '../application/seedDefaults';
import { PostponementService } from '../application/postponementService';
import { InMemoryMessagingStore } from '../testSupport/inMemoryStore';
import { ContractFacts } from '../domain/types';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  }),
}));

describe('reminder engine', () => {
  const contractId = '11111111-1111-4111-8111-111111111111';
  const clientId = '22222222-2222-4222-8222-222222222222';
  const doulaId = '33333333-3333-4333-8333-333333333333';

  let store: InMemoryMessagingStore;
  let now: Date;
  let sent: Array<{ to: string; subject: string; text: string }>;
  let voids: string[];
  let engine: ReminderEngine;
  let postponements: PostponementService;

  function facts(overrides: Partial<ContractFacts> = {}): ContractFacts {
    return {
      id: contractId,
      clientId,
      status: 'sent',
      sentAt: now,
      clientFirstName: 'Ada',
      clientLastName: 'Lovelace',
      clientEmail: 'ada@example.test',
      doulaId,
      doulaName: 'Donna Doula',
      doulaEmail: 'donna@example.test',
      depositRequired: true,
      depositPaid: false,
      remindersStopped: false,
      ...overrides,
    };
  }

  beforeEach(async () => {
    store = new InMemoryMessagingStore();
    await loadDefaultSeed(store);
    now = new Date('2026-10-01T12:00:00.000Z');
    sent = [];
    voids = [];
    store.contracts.set(contractId, facts());
    store.clients.set(clientId, {
      id: clientId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      status: 'active',
      dueDate: new Date('2026-10-15T00:00:00.000Z'),
      birthOutcomesRecorded: false,
      doulaId,
      doulaName: 'Donna Doula',
      doulaEmail: 'donna@example.test',
      lastNoteAt: new Date('2026-09-20T00:00:00.000Z'),
      postpartumHoursLogged: 8,
      hoursContracted: 10,
      depositPaid: false,
      cardOnFile: false,
    });
    store.doulas.set(doulaId, { email: 'donna@example.test', name: 'Donna Doula' });
    const overdue = (await store.getPolicyByKey('overdue_notes'))!;
    overdue.enabled = false;
    const birth = (await store.getPolicyByKey('birth_outcomes'))!;
    birth.enabled = false;
    engine = new ReminderEngine(
      store,
      {
        sendEmail: async (to, subject, text) => {
          sent.push({ to, subject, text });
        },
      },
      {
        voidIfUnsigned: async (id) => {
          const contract = store.contracts.get(id);
          if (!contract) return 'not_found';
          if (contract.status === 'signed') return 'skipped_signed';
          voids.push(id);
          contract.status = 'voided';
          return 'voided';
        },
      },
      {
        issue: async () => 'https://crm.test/signing#invitation=token',
      },
      { now: () => now }
    );
    postponements = new PostponementService(store, engine, () => now);
  });

  async function sendContract(): Promise<void> {
    await engine.handleEvent({
      type: 'contract_sent',
      contractId,
      clientId,
      signingUrl: 'https://crm.test/signing#invitation=token',
      sentAt: now,
    });
  }

  it('renders the initial contract email with the cancel date', async () => {
    const rendered = await engine.renderContractSentInitial({
      contractId,
      clientId,
      signingUrl: 'https://crm.test/signing#invitation=token',
      sentAt: now,
    });
    expect(rendered?.cancelDate).toBe('2026-10-08');
    expect(rendered?.text).toContain('2026-10-08');
    expect(rendered?.text).toContain('hello@sokanacollective.com');
  });

  it('sends day-3 client reminder and doula nudge, then voids once on day 7', async () => {
    await sendContract();
    store.releaseClaims();
    now = addDelay(now, 3, 'days');
    await engine.tick();
    const day3 = sent.map((s) => s.to).sort();
    expect(day3).toEqual(['ada@example.test', 'donna@example.test']);
    expect(sent.some((s) => s.text.includes('haven\'t signed yet'))).toBe(true);

    sent.length = 0;
    store.releaseClaims();
    now = addDelay(now, 4, 'days');
    await engine.tick();
    expect(voids).toEqual([contractId]);
    expect(sent.some((s) => s.text.includes('hello@sokanacollective.com'))).toBe(
      true
    );
    expect(
      store.alerts.some((a) => a.type === 'contract_auto_canceled')
    ).toBe(true);
    expect(
      sent.some((s) => s.to === 'hello@sokanacollective.com')
    ).toBe(false);

    sent.length = 0;
    voids.length = 0;
    store.releaseClaims();
    await engine.tick();
    expect(voids).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('sends nothing when signed and deposit paid before day 3', async () => {
    await sendContract();
    store.contracts.set(
      contractId,
      facts({ status: 'signed', depositPaid: true, depositRequired: true })
    );
    store.releaseClaims();
    now = addDelay(now, 3, 'days');
    await engine.tick();
    expect(sent).toEqual([]);
    expect(voids).toEqual([]);
  });

  it('never voids a signed unpaid contract at day 7; creates an admin alert', async () => {
    await sendContract();
    store.contracts.set(
      contractId,
      facts({ status: 'signed', depositPaid: false, depositRequired: true })
    );
    store.releaseClaims();
    now = addDelay(now, 7, 'days');
    await engine.tick();
    expect(voids).toEqual([]);
    expect(store.contracts.get(contractId)?.status).toBe('signed');
    expect(
      store.alerts.some(
        (a) =>
          a.type === 'signed_deposit_unpaid' &&
          a.message.includes('signed, deposit not received')
      )
    ).toBe(true);
  });

  it('suppresses sends and voids when the kill switch is off', async () => {
    await sendContract();
    store.settings.remindersEnabled = false;
    store.releaseClaims();
    now = addDelay(now, 7, 'days');
    const result = await engine.tick();
    expect(result.suppressed).toBe(true);
    expect(sent).toEqual([]);
    expect(voids).toEqual([]);
  });

  it('pauses reminders and cancel, then auto-restarts at restart_at from step 1', async () => {
    await sendContract();
    const created = await postponements.create({
      clientId,
      contractId,
      reasonCode: 'waiting_paycheck',
      actorId: 'admin-1',
      asAdmin: true,
      restartAt: addDelay(now, 14, 'days'),
    });
    expect(store.runs.some((r) => r.status === 'paused')).toBe(true);

    store.releaseClaims();
    now = addDelay(now, 7, 'days');
    await engine.tick();
    expect(voids).toEqual([]);

    store.releaseClaims();
    now = created.postponement.restartAt;
    await engine.tick();
    expect(
      store.alerts.some((a) => a.type === 'postponement_restarted')
    ).toBe(true);
    const run = store.runs.find((r) => r.policyKey === 'contract_signing');
    expect(run?.status).toBe('active');
    expect(run?.endActionDueAt?.toISOString().slice(0, 10)).toBe(
      addDelay(created.postponement.restartAt, 7, 'days').toISOString().slice(0, 10)
    );

    store.releaseClaims();
    now = addDelay(created.postponement.restartAt, 3, 'days');
    sent.length = 0;
    await engine.tick();
    expect(sent.map((s) => s.to).sort()).toEqual([
      'ada@example.test',
      'donna@example.test',
    ]);
  });

  it('supports lift, extend, and cancel on postponements', async () => {
    await sendContract();
    const created = await postponements.create({
      clientId,
      contractId,
      reasonCode: 'other',
      actorId: 'admin-1',
      asAdmin: true,
      restartAt: addDelay(now, 14, 'days'),
    });
    const extended = await postponements.extend(
      created.postponement.id,
      'admin-1',
      addDelay(now, 21, 'days')
    );
    expect(extended.postponement.restartAt.toISOString().slice(0, 10)).toBe(
      '2026-10-22'
    );
    await postponements.lift(created.postponement.id, 'admin-1');
    expect(store.runs.find((r) => r.policyKey === 'contract_signing')?.status).toBe(
      'active'
    );

    const second = await postponements.create({
      clientId,
      contractId,
      reasonCode: 'waiting_insurance_medicaid',
      actorId: 'admin-1',
      asAdmin: true,
      restartAt: addDelay(now, 14, 'days'),
    });
    await postponements.cancel(second.postponement.id, 'admin-1');
    expect(voids).toEqual([contractId]);
  });

  it('stops per-contract reminders and re-anchors on resume', async () => {
    await sendContract();
    await engine.stopContractReminders(contractId, 'admin-1', 'manual');
    store.releaseClaims();
    now = addDelay(now, 3, 'days');
    await engine.tick();
    expect(sent).toEqual([]);

    const resumeAt = now;
    await engine.resumeContractReminders(contractId, 'admin-1');
    const run = store.runs.find((r) => r.policyKey === 'contract_signing');
    expect(run?.status).toBe('active');
    expect(run?.anchorAt.toISOString()).toBe(resumeAt.toISOString());
  });

  it('does not start a birth-outcomes run if outcomes are already recorded', async () => {
    const birth = (await store.getPolicyByKey('birth_outcomes'))!;
    birth.enabled = true;
    store.clients.get(clientId)!.birthOutcomesRecorded = true;
    await engine.handleEvent({ type: 'baby_delivered', clientId });
    expect(store.runs.filter((r) => r.policyKey === 'birth_outcomes')).toEqual([]);
  });

  it('first birth-outcomes send is at due date + 5 and alerts once after 3 sends', async () => {
    const birth = (await store.getPolicyByKey('birth_outcomes'))!;
    birth.enabled = true;
    now = new Date('2026-10-20T12:00:00.000Z');
    await engine.tick();
    const birthSends = sent.filter((s) => s.to === 'donna@example.test');
    expect(birthSends.length).toBe(1);

    store.releaseClaims();
    now = addDelay(now, 2, 'days');
    await engine.tick();
    store.releaseClaims();
    now = addDelay(now, 2, 'days');
    await engine.tick();
    expect(
      store.alerts.filter((a) => a.type === 'birth_outcomes_admin_threshold')
    ).toHaveLength(1);
  });

  it('overdue notes honor overdue_days of 7 and 10', async () => {
    const notes = (await store.getPolicyByKey('overdue_notes'))!;
    notes.enabled = true;
    store.clients.get(clientId)!.lastNoteAt = addDelay(now, -8, 'days');

    notes.config.overdue_days = 10;
    let candidates = await store.listOverdueNoteCandidates(now, 10);
    expect(candidates.map((c) => c.id)).not.toContain(clientId);
    candidates = await store.listOverdueNoteCandidates(now, 7);
    expect(candidates.map((c) => c.id)).toContain(clientId);

    notes.config.overdue_days = 7;
    await engine.tick();
    expect(sent.some((s) => s.to === 'donna@example.test')).toBe(true);
    expect(sent.some((s) => s.to === 'hello@sokanacollective.com')).toBe(true);
  });

  it('disabled Oct 9 seeds do not send until enabled, then target the right role', async () => {
    await engine.handleEvent({ type: 'client_completed', clientId });
    await engine.handleEvent({ type: 'evaluation_received', clientId });
    await engine.handleEvent({ type: 'hours_logged', clientId });
    await engine.handleEvent({
      type: 'deposit_paid_no_card',
      clientId,
      contractId,
    });
    await engine.handleEvent({
      type: 'note_created',
      clientId,
      activityType: 'interview',
      createdByRole: 'doula',
    });
    expect(sent).toEqual([]);
    expect(store.policies.some((p) => p.key === 'deposit_payment')).toBe(false);

    for (const key of [
      'service_completed_evaluation',
      'evaluation_received',
      'postpartum_hours_low',
      'card_not_on_file',
      'doula_interview_logged',
    ]) {
      const policy = (await store.getPolicyByKey(key))!;
      policy.enabled = true;
    }
    store.clients.get(clientId)!.depositPaid = true;
    store.clients.get(clientId)!.cardOnFile = false;

    await engine.handleEvent({ type: 'client_completed', clientId });
    await engine.handleEvent({ type: 'evaluation_received', clientId });
    await engine.handleEvent({ type: 'hours_logged', clientId });
    await engine.handleEvent({
      type: 'deposit_paid_no_card',
      clientId,
      contractId,
    });
    await engine.handleEvent({
      type: 'note_created',
      clientId,
      activityType: 'interview',
      createdByRole: 'doula',
    });

    expect(sent.some((s) => s.to === 'ada@example.test')).toBe(true);
    expect(sent.some((s) => s.to === 'hello@sokanacollective.com')).toBe(true);
    expect(sent.some((s) => s.to === 'billing@sokanacollective.com')).toBe(true);
  });

  it('concurrent ticks produce a single send via idempotency', async () => {
    await sendContract();
    now = addDelay(now, 3, 'days');
    await Promise.all([engine.tick(), engine.tick()]);
    const clientMails = sent.filter((s) => s.to === 'ada@example.test');
    const doulaMails = sent.filter((s) => s.to === 'donna@example.test');
    expect(clientMails).toHaveLength(1);
    expect(doulaMails).toHaveLength(1);
    const keys = store.sendLog.map((row) => row.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
