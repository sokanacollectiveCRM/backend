import { PostponementService } from '../application/postponementService';
import { ReminderEngine } from '../application/reminderEngine';
import { ContractFacts } from '../domain/types';
import { InMemoryReminderStore } from '../infrastructure/inMemoryReminderStore';
import { seedInMemoryMessaging } from '../seeds/defaultMessaging';

describe('ReminderEngine', () => {
  let store: InMemoryReminderStore;
  let sent: Array<{ to: string; subject: string; text: string }>;
  let now: Date;
  let engine: ReminderEngine;
  let voids: string[];

  const mailer = {
    sendEmail: jest.fn(async (to: string, subject: string, text: string) => {
      sent.push({ to, subject, text });
    }),
  };

  function makeContract(
    overrides: Partial<ContractFacts> & { id?: string } = {}
  ): ContractFacts {
    const id = overrides.id || '11111111-1111-4111-8111-000000000001';
    const sentAt = overrides.sentAt ?? new Date('2026-10-01T12:00:00.000Z');
    return {
      id,
      clientId: '22222222-2222-4222-8222-000000000001',
      status: 'sent',
      sentAt,
      clientEmail: 'client@example.test',
      clientFirstName: 'Ada',
      clientLastName: 'Client',
      doulaId: '33333333-3333-4333-8333-000000000001',
      doulaName: 'Dana Doula',
      doulaEmail: 'doula@example.test',
      depositDue: true,
      depositPaid: false,
      remindersStopped: false,
      contractedHours: 20,
      ...overrides,
    };
  }

  async function startSigning(contract = makeContract()) {
    store.contracts.set(contract.id, contract);
    store.clients.set(contract.clientId, {
      id: contract.clientId,
      firstName: contract.clientFirstName,
      lastName: contract.clientLastName,
      email: contract.clientEmail,
      status: 'active',
      dueDate: new Date('2026-10-15T00:00:00.000Z'),
      babyDeliveredAt: null,
      birthOutcomesRecorded: false,
      doulaId: contract.doulaId,
      doulaName: contract.doulaName,
      doulaEmail: contract.doulaEmail,
      lastNoteAt: now,
      cardOnFile: false,
      depositPaid: contract.depositPaid,
      postpartumHours: 0,
      contractedHours: contract.contractedHours,
    });
    return engine.startRun({
      policyKey: 'contract_signing',
      subjectType: 'contract',
      subjectId: contract.id,
      clientId: contract.clientId,
      contractId: contract.id,
      doulaId: contract.doulaId,
      anchorAt: contract.sentAt || now,
    });
  }

  beforeEach(() => {
    store = new InMemoryReminderStore();
    seedInMemoryMessaging(store);
    sent = [];
    voids = [];
    now = new Date('2026-10-01T12:00:00.000Z');
    mailer.sendEmail.mockClear();
    const originalVoid = store.voidUnsignedContract.bind(store);
    store.voidUnsignedContract = async (id) => {
      voids.push(id);
      return originalVoid(id);
    };
    engine = new ReminderEngine({
      store,
      mailer,
      clock: { now: () => now },
    });
  });

  it('does not seed a deposit_payment policy', async () => {
    const policies = await store.listPolicies();
    expect(policies.map((p) => p.key)).not.toContain('deposit_payment');
  });

  it('renders the initial contract email with the cancel date', async () => {
    const rendered = await engine.renderContractSentInitial({
      contractId: 'c1',
      clientFirstName: 'Ada',
      clientLastName: 'Client',
      signingUrl: 'https://example.test/sign',
      sentAt: now,
    });
    expect(rendered?.text).toContain('2026-10-08');
    expect(rendered?.text.toLowerCase()).toContain('reserve your doula');
  });

  it('sends day 3 client reminder and doula nudge, then voids once on day 7', async () => {
    const contract = makeContract();
    await startSigning(contract);

    now = new Date('2026-10-04T12:00:00.000Z');
    const day3 = await engine.tick();
    expect(day3.sent).toBe(2);
    expect(sent.map((s) => s.to).sort()).toEqual([
      'client@example.test',
      'doula@example.test',
    ]);
    expect(sent.find((s) => s.to.startsWith('client'))?.text).toContain(
      '2026-10-08'
    );
    expect(sent.find((s) => s.to.startsWith('doula'))?.text).toContain(
      "hasn't signed yet"
    );

    sent.length = 0;
    now = new Date('2026-10-08T12:00:00.000Z');
    const day7 = await engine.tick();
    expect(day7.endActions).toBe(1);
    expect(voids).toEqual([contract.id]);
    expect(
      sent.some((s) => s.text.includes('hello@sokanacollective.com'))
    ).toBe(true);
    const alerts = await store.listAlerts({});
    expect(alerts.rows.some((a) => a.type === 'contract_auto_canceled')).toBe(
      true
    );
    expect(sent.some((s) => s.to === 'hello@sokanacollective.com')).toBe(false);

    sent.length = 0;
    voids.length = 0;
    await engine.tick();
    expect(voids).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('sends nothing when signed and deposit paid before day 3', async () => {
    const contract = makeContract({ status: 'signed', depositPaid: true });
    await startSigning(contract);
    now = new Date('2026-10-04T12:00:00.000Z');
    await engine.tick();
    expect(sent).toHaveLength(0);
    expect(voids).toHaveLength(0);
  });

  it('never voids a signed contract with unpaid deposit; creates an admin alert', async () => {
    const contract = makeContract({ status: 'signed', depositPaid: false });
    await startSigning(contract);
    now = new Date('2026-10-08T12:00:00.000Z');
    await engine.tick();
    expect(voids).toHaveLength(0);
    expect(store.contracts.get(contract.id)?.status).toBe('signed');
    const alerts = await store.listAlerts({});
    expect(
      alerts.rows.some((a) => a.message.includes('deposit not received'))
    ).toBe(true);
  });

  it('suppresses sends and voids when the kill switch is off', async () => {
    await startSigning();
    store.settings.reminders_enabled = false;
    now = new Date('2026-10-08T12:00:00.000Z');
    const result = await engine.tick();
    expect(result.suppressed).toBe(true);
    expect(sent).toHaveLength(0);
    expect(voids).toHaveLength(0);
  });

  it('produces one send across concurrent ticks', async () => {
    await startSigning();
    now = new Date('2026-10-04T12:00:00.000Z');
    await Promise.all([engine.tick(), engine.tick(), engine.tick()]);
    const clientSends = sent.filter((s) => s.to === 'client@example.test');
    expect(clientSends).toHaveLength(1);
    const logs = await store.listSendLog({});
    const clientLogs = logs.rows.filter(
      (row) => row.recipient_role === 'client' && row.status === 'sent'
    );
    expect(clientLogs).toHaveLength(1);
  });

  it('pauses on postponement and auto-restarts at restart_at from step 1', async () => {
    const contract = makeContract();
    await startSigning(contract);
    const postponements = new PostponementService(store, engine, {
      now: () => now,
    });
    const created = await postponements.create({
      clientId: contract.clientId,
      contractId: contract.id,
      reasonCode: 'waiting_paycheck',
      actorId: 'admin-1',
      restartAt: new Date('2026-10-15T12:00:00.000Z'),
    });
    expect(created.postponement.status).toBe('active');

    now = new Date('2026-10-04T12:00:00.000Z');
    await engine.tick();
    expect(sent.filter((s) => s.to === 'client@example.test')).toHaveLength(0);

    now = new Date('2026-10-15T12:00:00.000Z');
    await engine.tick();
    const run = (await store.listRunsForContract(contract.id)).find(
      (r) => r.policy_key === 'contract_signing'
    );
    expect(run?.status).toBe('active');
    expect(run?.anchor_at.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(run?.end_action_due_at?.toISOString()).toBe(
      '2026-10-22T12:00:00.000Z'
    );

    now = new Date('2026-10-18T12:00:00.000Z');
    sent.length = 0;
    await engine.tick();
    expect(sent.some((s) => s.to === 'client@example.test')).toBe(true);
  });

  it('supports postponement lift, extend, and cancel', async () => {
    const contract = makeContract();
    await startSigning(contract);
    const postponements = new PostponementService(store, engine, {
      now: () => now,
    });
    const created = await postponements.create({
      clientId: contract.clientId,
      contractId: contract.id,
      reasonCode: 'other',
      actorId: 'admin-1',
    });
    const paused = await store.listRunsForContract(contract.id);
    expect(paused[0].status).toBe('paused');

    const extended = await postponements.extend(
      created.postponement.id,
      new Date('2026-10-20T12:00:00.000Z'),
      'admin-1'
    );
    expect(extended.postponement?.restart_at.toISOString()).toBe(
      '2026-10-20T12:00:00.000Z'
    );

    await postponements.lift(created.postponement.id, 'admin-1');
    const lifted = await store.getPostponement(created.postponement.id);
    expect(lifted?.status).toBe('lifted');

    const second = await postponements.create({
      clientId: contract.clientId,
      contractId: contract.id,
      reasonCode: 'waiting_insurance_medicaid',
      actorId: 'admin-1',
    });
    await postponements.cancel(second.postponement.id, 'admin-1');
    expect((await store.getPostponement(second.postponement.id))?.status).toBe(
      'canceled'
    );
  });

  it('stops sends on per-contract stop and re-anchors on resume', async () => {
    const contract = makeContract();
    await startSigning(contract);
    await engine.stopContractReminders(contract.id, 'nancy override');
    now = new Date('2026-10-04T12:00:00.000Z');
    await engine.tick();
    expect(sent.filter((s) => s.to === 'client@example.test')).toHaveLength(0);

    now = new Date('2026-10-09T12:00:00.000Z');
    await engine.resumeContractReminders(contract.id);
    const run = (await store.listRunsForContract(contract.id))[0];
    expect(run.status).toBe('active');
    expect(run.anchor_at.toISOString()).toBe(now.toISOString());
  });

  it('skips birth-outcome runs when already recorded, sends at due date + 5, alerts after 3', async () => {
    const clientId = '22222222-2222-4222-8222-000000000009';
    store.clients.set(clientId, {
      id: clientId,
      firstName: 'Bea',
      lastName: 'Baby',
      email: 'bea@example.test',
      status: 'active',
      dueDate: new Date('2026-10-15T00:00:00.000Z'),
      babyDeliveredAt: null,
      birthOutcomesRecorded: true,
      doulaId: 'd1',
      doulaName: 'Dana',
      doulaEmail: 'doula@example.test',
      lastNoteAt: new Date('2026-10-20T00:00:00.000Z'),
      cardOnFile: true,
      depositPaid: true,
      postpartumHours: 0,
      contractedHours: 20,
    });
    const skipped = await engine.startRun({
      policyKey: 'birth_outcomes',
      subjectType: 'client',
      subjectId: clientId,
      clientId,
      anchorAt: new Date('2026-10-20T00:00:00.000Z'),
    });
    expect(skipped).toBeNull();

    store.clients.get(clientId)!.birthOutcomesRecorded = false;
    now = new Date('2026-10-20T00:00:00.000Z');
    await engine.tick();
    expect(sent.some((s) => s.to === 'doula@example.test')).toBe(true);

    sent.length = 0;
    now = new Date('2026-10-22T00:00:00.000Z');
    await engine.tick();
    now = new Date('2026-10-24T00:00:00.000Z');
    await engine.tick();
    const alerts = await store.listAlerts({});
    expect(
      alerts.rows.filter((a) => a.type === 'birth_outcomes_admin_after_sends')
    ).toHaveLength(1);
  });

  it('honors overdue_days of 7 and 10', async () => {
    const clientId = '22222222-2222-4222-8222-000000000010';
    store.clients.set(clientId, {
      id: clientId,
      firstName: 'Ned',
      lastName: 'Notes',
      email: 'ned@example.test',
      status: 'active',
      dueDate: null,
      babyDeliveredAt: null,
      birthOutcomesRecorded: false,
      doulaId: 'd1',
      doulaName: 'Dana',
      doulaEmail: 'doula@example.test',
      lastNoteAt: new Date('2026-10-01T00:00:00.000Z'),
      cardOnFile: true,
      depositPaid: true,
      postpartumHours: 0,
      contractedHours: 20,
    });

    now = new Date('2026-10-09T00:00:00.000Z');
    await engine.tick();
    expect(sent.some((s) => s.to === 'doula@example.test')).toBe(true);
    expect(sent.some((s) => s.to === 'hello@sokanacollective.com')).toBe(true);

    const store10 = new InMemoryReminderStore();
    seedInMemoryMessaging(store10);
    const policy = await store10.getPolicyByKey('overdue_notes');
    await store10.updatePolicy(
      policy!.id,
      { config: { overdue_days: 10 } },
      't'
    );
    store10.clients.set(clientId, store.clients.get(clientId)!);
    const engine10 = new ReminderEngine({
      store: store10,
      mailer,
      clock: { now: () => now },
    });
    const before = sent.length;
    await engine10.tick();
    expect(sent.length).toBe(before);
  });

  it('does not send disabled Oct 9 seeds until enabled, then routes billing to billing email', async () => {
    const clientId = '22222222-2222-4222-8222-000000000011';
    store.clients.set(clientId, {
      id: clientId,
      firstName: 'Cam',
      lastName: 'Card',
      email: 'cam@example.test',
      status: 'complete',
      dueDate: null,
      babyDeliveredAt: null,
      birthOutcomesRecorded: false,
      doulaId: 'd1',
      doulaName: 'Dana',
      doulaEmail: 'doula@example.test',
      lastNoteAt: now,
      cardOnFile: false,
      depositPaid: true,
      postpartumHours: 16,
      contractedHours: 20,
    });

    const disabled = await engine.startRun({
      policyKey: 'card_not_on_file',
      subjectType: 'client',
      subjectId: `${clientId}:card-missing`,
      clientId,
      anchorAt: now,
      processImmediately: true,
    });
    expect(disabled).toBeNull();
    expect(sent).toHaveLength(0);

    const policy = await store.getPolicyByKey('card_not_on_file');
    await store.updatePolicy(policy!.id, { enabled: true }, 'admin');
    await engine.startRun({
      policyKey: 'card_not_on_file',
      subjectType: 'client',
      subjectId: `${clientId}:card-missing`,
      clientId,
      anchorAt: now,
      processImmediately: true,
    });
    expect(sent.some((s) => s.to === 'billing@sokanacollective.com')).toBe(
      true
    );

    sent.length = 0;
    const evalPolicy = await store.getPolicyByKey(
      'service_completed_evaluation'
    );
    expect(evalPolicy?.enabled).toBe(false);
    await engine.startRun({
      policyKey: 'service_completed_evaluation',
      subjectType: 'client_completion',
      subjectId: `${clientId}:done`,
      clientId,
      anchorAt: now,
      processImmediately: true,
    });
    expect(sent).toHaveLength(0);
  });
});
