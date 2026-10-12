import { randomUUID } from 'crypto';

import {
  InsertSendLogInput,
  MessagingStore,
  UniqueViolationError,
} from '../application/store';
import {
  AdminAlert,
  ClientFacts,
  ClientPostponement,
  ContractFacts,
  ContractReminderOverride,
  MessageTemplate,
  MessagingSettings,
  PostponementEvent,
  ReminderPolicy,
  ReminderPolicyStep,
  ReminderRun,
  ReminderSendLog,
  RunStatus,
  SendStatus,
} from '../domain/types';

export class InMemoryMessagingStore implements MessagingStore {
  settings: MessagingSettings = {
    remindersEnabled: true,
    testRecipientOverrideEmail: null,
    contactEmail: 'hello@sokanacollective.com',
    adminNotificationEmail: 'hello@sokanacollective.com',
    billingNotificationEmail: 'billing@sokanacollective.com',
    evaluationLink: 'https://forms.gle/sokana-evaluation',
  };

  policies: ReminderPolicy[] = [];
  templates: MessageTemplate[] = [];
  runs: ReminderRun[] = [];
  sendLog: ReminderSendLog[] = [];
  alerts: AdminAlert[] = [];
  overrides = new Map<string, ContractReminderOverride>();
  contracts = new Map<string, ContractFacts>();
  clients = new Map<string, ClientFacts>();
  postponements: ClientPostponement[] = [];
  postponementEvents: PostponementEvent[] = [];
  doulas = new Map<string, { email: string | null; name: string }>();

  private claimed = new Set<string>();

  async getSettings(): Promise<MessagingSettings> {
    return { ...this.settings };
  }

  async updateSettings(
    patch: Partial<MessagingSettings>
  ): Promise<MessagingSettings> {
    this.settings = { ...this.settings, ...patch };
    return { ...this.settings };
  }

  async listPolicies(): Promise<ReminderPolicy[]> {
    return this.policies.map((p) => ({
      ...p,
      steps: [...p.steps],
      config: { ...p.config },
    }));
  }

  async getPolicyById(id: string): Promise<ReminderPolicy | null> {
    return this.policies.find((p) => p.id === id) ?? null;
  }

  async getPolicyByKey(key: string): Promise<ReminderPolicy | null> {
    return this.policies.find((p) => p.key === key) ?? null;
  }

  async updatePolicy(
    id: string,
    patch: Record<string, unknown>
  ): Promise<ReminderPolicy> {
    const policy = this.policies.find((p) => p.id === id);
    if (!policy) throw new Error('Policy not found');
    Object.assign(policy, patch, { updatedAt: new Date() });
    return policy;
  }

  async replaceSteps(
    policyId: string,
    steps: Omit<ReminderPolicyStep, 'id' | 'policyId'>[]
  ): Promise<ReminderPolicyStep[]> {
    const policy = this.policies.find((p) => p.id === policyId);
    if (!policy) throw new Error('Policy not found');
    policy.steps = steps.map((step, i) => ({
      ...step,
      id: randomUUID(),
      policyId,
      stepOrder: step.stepOrder ?? i,
    }));
    return policy.steps;
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    return [...this.templates];
  }

  async getTemplateById(id: string): Promise<MessageTemplate | null> {
    return this.templates.find((t) => t.id === id) ?? null;
  }

  async getTemplateByKey(key: string): Promise<MessageTemplate | null> {
    return this.templates.find((t) => t.key === key) ?? null;
  }

  async updateTemplate(
    id: string,
    patch: Partial<MessageTemplate>
  ): Promise<MessageTemplate> {
    const template = this.templates.find((t) => t.id === id);
    if (!template) throw new Error('Template not found');
    Object.assign(template, patch, {
      version: template.version + 1,
      updatedAt: new Date(),
    });
    return template;
  }

  async createRun(
    input: Omit<ReminderRun, 'id' | 'claimedUntil'> & { id?: string }
  ): Promise<ReminderRun> {
    const existing = await this.findOpenRun(
      input.policyId,
      input.subjectType,
      input.subjectId
    );
    if (existing) return existing;
    const run: ReminderRun = {
      ...input,
      id: input.id ?? randomUUID(),
      claimedUntil: null,
    };
    this.runs.push(run);
    return run;
  }

  async getRunById(id: string): Promise<ReminderRun | null> {
    return this.runs.find((r) => r.id === id) ?? null;
  }

  async findOpenRun(
    policyId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ReminderRun | null> {
    return (
      this.runs.find(
        (r) =>
          r.policyId === policyId &&
          r.subjectType === subjectType &&
          r.subjectId === subjectId &&
          (r.status === 'active' || r.status === 'paused')
      ) ?? null
    );
  }

  async listRuns(filters: {
    status?: RunStatus | RunStatus[];
    policyKey?: string;
    clientId?: string;
    contractId?: string;
  }): Promise<ReminderRun[]> {
    const statuses = filters.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;
    return this.runs.filter((run) => {
      if (statuses && !statuses.includes(run.status)) return false;
      if (filters.policyKey && run.policyKey !== filters.policyKey)
        return false;
      if (filters.clientId && run.clientId !== filters.clientId) return false;
      if (filters.contractId && run.contractId !== filters.contractId)
        return false;
      return true;
    });
  }

  async updateRun(
    id: string,
    patch: Partial<ReminderRun>
  ): Promise<ReminderRun> {
    const run = this.runs.find((r) => r.id === id);
    if (!run) throw new Error('Run not found');
    Object.assign(run, patch);
    return run;
  }

  async claimDueRuns(now: Date, limit: number): Promise<ReminderRun[]> {
    const due = this.runs.filter((run) => {
      if (run.status !== 'active') return false;
      if (this.claimed.has(run.id)) return false;
      const nextDue = run.nextDueAt && run.nextDueAt.getTime() <= now.getTime();
      const endDue =
        run.endActionDueAt && run.endActionDueAt.getTime() <= now.getTime();
      return Boolean(nextDue || endDue);
    });
    const claimed = due.slice(0, limit);
    for (const run of claimed) this.claimed.add(run.id);
    return claimed;
  }

  releaseClaims(): void {
    this.claimed.clear();
  }

  async pauseRunsForSubject(input: {
    clientId?: string | null;
    contractId?: string | null;
    reason: string;
  }): Promise<ReminderRun[]> {
    const paused: ReminderRun[] = [];
    for (const run of this.runs) {
      if (run.status !== 'active') continue;
      const matchClient = input.clientId && run.clientId === input.clientId;
      const matchContract =
        input.contractId && run.contractId === input.contractId;
      if (matchClient || matchContract) {
        run.status = 'paused';
        run.pauseReason = input.reason;
        paused.push(run);
      }
    }
    return paused;
  }

  async insertSendLog(input: InsertSendLogInput): Promise<ReminderSendLog> {
    if (
      this.sendLog.some((row) => row.idempotencyKey === input.idempotencyKey)
    ) {
      throw new UniqueViolationError();
    }
    const row: ReminderSendLog = {
      id: randomUUID(),
      runId: input.runId,
      policyKey: input.policyKey,
      stepOrder: input.stepOrder,
      templateKey: input.templateKey,
      templateVersion: input.templateVersion,
      idempotencyKey: input.idempotencyKey,
      recipientRole: input.recipientRole,
      recipientEmail: input.recipientEmail,
      channel: input.channel,
      status: input.status,
      suppressReason: input.suppressReason ?? null,
      errorClass: input.errorClass ?? null,
      createdAt: new Date(),
    };
    this.sendLog.push(row);
    return row;
  }

  async findSendLogByKey(
    idempotencyKey: string
  ): Promise<ReminderSendLog | null> {
    return (
      this.sendLog.find((row) => row.idempotencyKey === idempotencyKey) ?? null
    );
  }

  async listSendLog(input: {
    limit: number;
    offset: number;
    policyKey?: string;
    status?: SendStatus;
  }): Promise<{ rows: ReminderSendLog[]; total: number }> {
    let rows = [...this.sendLog].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    if (input.policyKey)
      rows = rows.filter((r) => r.policyKey === input.policyKey);
    if (input.status) rows = rows.filter((r) => r.status === input.status);
    return {
      total: rows.length,
      rows: rows.slice(input.offset, input.offset + input.limit),
    };
  }

  async countSendsForRunStep(
    runId: string,
    stepOrder: number
  ): Promise<number> {
    return this.sendLog.filter(
      (row) =>
        row.runId === runId &&
        row.stepOrder === stepOrder &&
        row.status === 'sent'
    ).length;
  }

  async createAlert(input: {
    type: string;
    clientId?: string | null;
    contractId?: string | null;
    runId?: string | null;
    message: string;
  }): Promise<AdminAlert> {
    const alert: AdminAlert = {
      id: randomUUID(),
      type: input.type,
      clientId: input.clientId ?? null,
      contractId: input.contractId ?? null,
      runId: input.runId ?? null,
      message: input.message,
      createdAt: new Date(),
      acknowledgedBy: null,
      acknowledgedAt: null,
    };
    this.alerts.push(alert);
    return alert;
  }

  async listAlerts(unacknowledgedOnly?: boolean): Promise<AdminAlert[]> {
    return this.alerts.filter((a) =>
      unacknowledgedOnly ? !a.acknowledgedAt : true
    );
  }

  async acknowledgeAlert(
    id: string,
    actorId: string
  ): Promise<AdminAlert | null> {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.acknowledgedBy = actorId;
    alert.acknowledgedAt = new Date();
    return alert;
  }

  async getContractOverride(
    contractId: string
  ): Promise<ContractReminderOverride | null> {
    return this.overrides.get(contractId) ?? null;
  }

  async upsertContractOverride(
    input: ContractReminderOverride
  ): Promise<ContractReminderOverride> {
    this.overrides.set(input.contractId, input);
    return input;
  }

  async getContractFacts(contractId: string): Promise<ContractFacts | null> {
    return this.contracts.get(contractId) ?? null;
  }

  async getClientFacts(clientId: string): Promise<ClientFacts | null> {
    return this.clients.get(clientId) ?? null;
  }

  async listDueDateScanCandidates(
    now: Date,
    daysAfter: number
  ): Promise<ClientFacts[]> {
    const cutoff = new Date(now.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - daysAfter);
    return [...this.clients.values()].filter((client) => {
      if (client.birthOutcomesRecorded || !client.dueDate) return false;
      return client.dueDate.getTime() <= cutoff.getTime();
    });
  }

  async listOverdueNoteCandidates(
    now: Date,
    overdueDays: number
  ): Promise<ClientFacts[]> {
    const cutoff = new Date(now.getTime() - overdueDays * 24 * 60 * 60 * 1000);
    return [...this.clients.values()].filter((client) => {
      if (!client.doulaId) return false;
      if (!client.lastNoteAt) return true;
      return client.lastNoteAt.getTime() < cutoff.getTime();
    });
  }

  async listHoursLowCandidates(
    thresholdHours: number,
    remainingPct: number
  ): Promise<ClientFacts[]> {
    return [...this.clients.values()].filter((client) => {
      if (client.hoursContracted == null || client.hoursContracted <= 0)
        return false;
      const remaining = client.hoursContracted - client.postpartumHoursLogged;
      const pct = (remaining / client.hoursContracted) * 100;
      return remaining <= thresholdHours || pct <= remainingPct;
    });
  }

  async listDepositPaidNoCardCandidates(): Promise<ClientFacts[]> {
    return [...this.clients.values()].filter(
      (client) => client.depositPaid && !client.cardOnFile
    );
  }

  async listDoulaEmail(
    doulaId: string
  ): Promise<{ email: string | null; name: string } | null> {
    return this.doulas.get(doulaId) ?? null;
  }

  async createPostponement(
    input: Omit<ClientPostponement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ClientPostponement> {
    const row: ClientPostponement = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.postponements.push(row);
    return row;
  }

  async getPostponement(id: string): Promise<ClientPostponement | null> {
    return this.postponements.find((p) => p.id === id) ?? null;
  }

  async listPostponements(clientId: string): Promise<ClientPostponement[]> {
    return this.postponements.filter((p) => p.clientId === clientId);
  }

  async listActivePostponementsDue(now: Date): Promise<ClientPostponement[]> {
    return this.postponements.filter(
      (p) => p.status === 'active' && p.restartAt.getTime() <= now.getTime()
    );
  }

  async findActivePostponement(input: {
    clientId?: string | null;
    contractId?: string | null;
  }): Promise<ClientPostponement | null> {
    return (
      this.postponements.find((p) => {
        if (p.status !== 'active') return false;
        if (input.contractId && p.contractId === input.contractId) return true;
        if (input.clientId && p.clientId === input.clientId) return true;
        return false;
      }) ?? null
    );
  }

  async updatePostponement(
    id: string,
    patch: Partial<ClientPostponement>
  ): Promise<ClientPostponement> {
    const row = this.postponements.find((p) => p.id === id);
    if (!row) throw new Error('Postponement not found');
    Object.assign(row, patch, { updatedAt: new Date() });
    return row;
  }

  async appendPostponementEvent(input: {
    postponementId: string;
    eventType: string;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<PostponementEvent> {
    const event: PostponementEvent = {
      id: randomUUID(),
      postponementId: input.postponementId,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      payload: input.payload ?? {},
      createdAt: new Date(),
    };
    this.postponementEvents.push(event);
    return event;
  }

  async listPostponementEvents(
    postponementId: string
  ): Promise<PostponementEvent[]> {
    return this.postponementEvents.filter(
      (e) => e.postponementId === postponementId
    );
  }
}
