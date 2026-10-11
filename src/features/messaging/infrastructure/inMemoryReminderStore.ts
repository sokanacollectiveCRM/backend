import { randomUUID } from 'crypto';

import {
  CreateRunInput,
  ListFilter,
  ReminderStore,
  SendLogInsert,
} from '../application/reminderStore';
import { addDelay } from '../domain/delays';
import {
  AdminAlert,
  ClientFacts,
  ClientPostponement,
  ContractFacts,
  MessageTemplate,
  MessagingSettings,
  PolicyWithSteps,
  PostponementEvent,
  ReminderPolicy,
  ReminderPolicyStep,
  ReminderRun,
  ReminderSendLog,
  SendStatus,
} from '../domain/types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_key, val) => {
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return val;
  });
}

function paginate<T>(
  rows: T[],
  filter: ListFilter
): { rows: T[]; total: number } {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length };
}

export class InMemoryReminderStore implements ReminderStore {
  policies = new Map<string, ReminderPolicy>();
  steps = new Map<string, ReminderPolicyStep[]>();
  templates = new Map<string, MessageTemplate>();
  runs = new Map<string, ReminderRun>();
  sendLogs: ReminderSendLog[] = [];
  postponements = new Map<string, ClientPostponement>();
  postponementEvents: PostponementEvent[] = [];
  alerts: AdminAlert[] = [];
  contracts = new Map<string, ContractFacts>();
  clients = new Map<string, ClientFacts>();
  claimed = new Set<string>();
  signingLinks = new Map<string, string>();
  settings: MessagingSettings = {
    reminders_enabled: true,
    test_recipient_override_email: null,
    contact_email: 'hello@sokanacollective.com',
    admin_notification_email: 'hello@sokanacollective.com',
    billing_notification_email: 'billing@sokanacollective.com',
    evaluation_link: 'https://forms.gle/sokana-evaluation-placeholder',
    overdue_days: 7,
    test_tools_enabled: false,
  };

  private withPolicy(policy: ReminderPolicy): PolicyWithSteps {
    return {
      ...clone(policy),
      steps: clone(this.steps.get(policy.id) || []).sort(
        (a, b) => a.step_order - b.step_order
      ),
    };
  }

  async getSettings(): Promise<MessagingSettings> {
    const overdue = (await this.getPolicyByKey('overdue_notes'))?.config
      .overdue_days;
    return {
      ...this.settings,
      overdue_days:
        typeof overdue === 'number' ? overdue : this.settings.overdue_days,
    };
  }

  async updateSettings(
    patch: Partial<
      Omit<MessagingSettings, 'overdue_days' | 'test_tools_enabled'>
    >,
    _actorId: string | null
  ): Promise<MessagingSettings> {
    this.settings = { ...this.settings, ...patch };
    return this.getSettings();
  }

  async listPolicies(): Promise<PolicyWithSteps[]> {
    return [...this.policies.values()].map((p) => this.withPolicy(p));
  }

  async getPolicy(id: string): Promise<PolicyWithSteps | null> {
    const policy = this.policies.get(id);
    return policy ? this.withPolicy(policy) : null;
  }

  async getPolicyByKey(key: string): Promise<PolicyWithSteps | null> {
    const policy = [...this.policies.values()].find((p) => p.key === key);
    return policy ? this.withPolicy(policy) : null;
  }

  async updatePolicy(
    id: string,
    patch: Partial<ReminderPolicy>,
    actorId: string | null
  ): Promise<PolicyWithSteps | null> {
    const current = this.policies.get(id);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      id: current.id,
      key: current.key,
      updated_by: actorId,
      updated_at: new Date(),
    };
    this.policies.set(id, next);
    return this.withPolicy(next);
  }

  async replaceSteps(
    id: string,
    steps: Array<Omit<ReminderPolicyStep, 'id' | 'policy_id'>>,
    actorId: string | null
  ): Promise<PolicyWithSteps | null> {
    const current = this.policies.get(id);
    if (!current) return null;
    this.steps.set(
      id,
      steps.map((step, index) => ({
        ...step,
        id: randomUUID(),
        policy_id: id,
        step_order: step.step_order ?? index + 1,
      }))
    );
    current.updated_by = actorId;
    current.updated_at = new Date();
    return this.withPolicy(current);
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    return [...this.templates.values()].map(clone);
  }

  async getTemplate(id: string): Promise<MessageTemplate | null> {
    const row = this.templates.get(id);
    return row ? clone(row) : null;
  }

  async getTemplateByKey(key: string): Promise<MessageTemplate | null> {
    const row = [...this.templates.values()].find((t) => t.key === key);
    return row ? clone(row) : null;
  }

  async updateTemplate(
    id: string,
    patch: Partial<
      Pick<
        MessageTemplate,
        'name' | 'channel' | 'subject' | 'body_text' | 'body_html'
      >
    >,
    actorId: string | null
  ): Promise<MessageTemplate | null> {
    const current = this.templates.get(id);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      version: current.version + 1,
      updated_by: actorId,
      updated_at: new Date(),
    };
    this.templates.set(id, next);
    return clone(next);
  }

  async findActiveOrPausedRun(
    policyId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ReminderRun | null> {
    const row = [...this.runs.values()].find(
      (run) =>
        run.policy_id === policyId &&
        run.subject_type === subjectType &&
        run.subject_id === subjectId &&
        (run.status === 'active' || run.status === 'paused')
    );
    return row ? clone(row) : null;
  }

  async getRun(id: string): Promise<ReminderRun | null> {
    const row = this.runs.get(id);
    return row ? clone(row) : null;
  }

  async createRun(input: CreateRunInput): Promise<ReminderRun> {
    const existing = await this.findActiveOrPausedRun(
      input.policy.id,
      input.subjectType,
      input.subjectId
    );
    if (existing) return existing;
    const run: ReminderRun = {
      id: randomUUID(),
      policy_id: input.policy.id,
      policy_key: input.policy.key,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      client_id: input.clientId ?? null,
      contract_id: input.contractId ?? null,
      doula_id: input.doulaId ?? null,
      status: input.status,
      anchor_at: input.anchorAt,
      current_step: input.currentStep,
      next_due_at: input.nextDueAt,
      end_action_due_at: input.endActionDueAt,
      sends_count: 0,
      pause_reason: input.pauseReason ?? null,
      completed_reason: null,
      admin_alerted: false,
    };
    this.runs.set(run.id, run);
    return clone(run);
  }

  async updateRun(
    id: string,
    patch: Partial<ReminderRun>
  ): Promise<ReminderRun | null> {
    const current = this.runs.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id };
    this.runs.set(id, next);
    return clone(next);
  }

  async listRuns(
    filter: ListFilter
  ): Promise<{ rows: ReminderRun[]; total: number }> {
    let rows = [...this.runs.values()];
    if (filter.status) rows = rows.filter((r) => r.status === filter.status);
    if (filter.policyKey)
      rows = rows.filter((r) => r.policy_key === filter.policyKey);
    if (filter.clientId)
      rows = rows.filter((r) => r.client_id === filter.clientId);
    if (filter.contractId)
      rows = rows.filter((r) => r.contract_id === filter.contractId);
    rows.sort(
      (a, b) =>
        (a.next_due_at?.getTime() ?? 0) - (b.next_due_at?.getTime() ?? 0)
    );
    return paginate(rows.map(clone), filter);
  }

  async listRunsForContract(contractId: string): Promise<ReminderRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.contract_id === contractId)
      .map(clone);
  }

  async pauseRunsForClient(
    clientId: string,
    contractId: string | null,
    reason: string
  ): Promise<number> {
    let count = 0;
    for (const run of this.runs.values()) {
      if (run.status !== 'active') continue;
      if (run.client_id !== clientId) continue;
      if (contractId && run.contract_id && run.contract_id !== contractId)
        continue;
      run.status = 'paused';
      run.pause_reason = reason;
      count += 1;
    }
    return count;
  }

  async claimDueRuns(now: Date, limit: number): Promise<ReminderRun[]> {
    const due = [...this.runs.values()]
      .filter((run) => {
        if (run.status !== 'active') return false;
        const stepDue =
          run.next_due_at && run.next_due_at.getTime() <= now.getTime();
        const endDue =
          run.end_action_due_at &&
          run.end_action_due_at.getTime() <= now.getTime();
        return Boolean(stepDue || endDue);
      })
      .sort(
        (a, b) =>
          (a.next_due_at?.getTime() ?? 0) - (b.next_due_at?.getTime() ?? 0)
      )
      .slice(0, limit);
    return due.map(clone);
  }

  async tryInsertSendLog(
    entry: SendLogInsert
  ): Promise<ReminderSendLog | 'duplicate'> {
    if (
      this.sendLogs.some((row) => row.idempotency_key === entry.idempotencyKey)
    ) {
      return 'duplicate';
    }
    const row: ReminderSendLog = {
      id: randomUUID(),
      run_id: entry.runId,
      policy_key: entry.policyKey,
      step_order: entry.stepOrder,
      template_key: entry.templateKey,
      template_version: entry.templateVersion,
      idempotency_key: entry.idempotencyKey,
      recipient_role: entry.recipientRole as ReminderSendLog['recipient_role'],
      recipient_email: entry.recipientEmail,
      channel: entry.channel as ReminderSendLog['channel'],
      status: entry.status,
      suppress_reason: entry.suppressReason ?? null,
      error_class: entry.errorClass ?? null,
      created_at: new Date(),
    };
    this.sendLogs.push(row);
    return clone(row);
  }

  async updateSendLog(
    id: string,
    patch: Partial<
      Pick<ReminderSendLog, 'status' | 'error_class' | 'suppress_reason'>
    >
  ): Promise<void> {
    const row = this.sendLogs.find((item) => item.id === id);
    if (!row) return;
    Object.assign(row, patch);
  }

  async listSendLog(
    filter: ListFilter
  ): Promise<{ rows: ReminderSendLog[]; total: number }> {
    let rows = [...this.sendLogs];
    if (filter.policyKey)
      rows = rows.filter((r) => r.policy_key === filter.policyKey);
    if (filter.clientId) {
      const runIds = new Set(
        [...this.runs.values()]
          .filter((run) => run.client_id === filter.clientId)
          .map((run) => run.id)
      );
      rows = rows.filter((r) => r.run_id && runIds.has(r.run_id));
    }
    rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return paginate(rows.map(clone), filter);
  }

  async countSendsForRunStep(
    runId: string,
    stepOrder: number,
    statuses: SendStatus[] = ['sent']
  ): Promise<number> {
    return this.sendLogs.filter(
      (row) =>
        row.run_id === runId &&
        row.step_order === stepOrder &&
        statuses.includes(row.status)
    ).length;
  }

  async listPostponements(clientId: string): Promise<ClientPostponement[]> {
    return [...this.postponements.values()]
      .filter((row) => row.client_id === clientId)
      .map(clone);
  }

  async getPostponement(id: string): Promise<ClientPostponement | null> {
    const row = this.postponements.get(id);
    return row ? clone(row) : null;
  }

  async createPostponement(
    input: Omit<ClientPostponement, 'id' | 'warning'> & {
      warning?: string | null;
    }
  ): Promise<ClientPostponement> {
    const row: ClientPostponement = {
      ...input,
      id: randomUUID(),
      warning: input.warning ?? null,
    };
    this.postponements.set(row.id, row);
    return clone(row);
  }

  async updatePostponement(
    id: string,
    patch: Partial<ClientPostponement>
  ): Promise<ClientPostponement | null> {
    const current = this.postponements.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id };
    this.postponements.set(id, next);
    return clone(next);
  }

  async appendPostponementEvent(
    input: Omit<PostponementEvent, 'id' | 'created_at'>
  ): Promise<PostponementEvent> {
    const row: PostponementEvent = {
      ...input,
      id: randomUUID(),
      created_at: new Date(),
    };
    this.postponementEvents.push(row);
    return clone(row);
  }

  async findActivePostponement(
    clientId: string,
    contractId?: string | null
  ): Promise<ClientPostponement | null> {
    const row = [...this.postponements.values()].find((item) => {
      if (item.client_id !== clientId) return false;
      if (item.status !== 'active' && item.status !== 'requested') return false;
      if (contractId && item.contract_id && item.contract_id !== contractId) {
        return false;
      }
      return item.status === 'active';
    });
    return row ? clone(row) : null;
  }

  async listDuePostponementRestarts(now: Date): Promise<ClientPostponement[]> {
    return [...this.postponements.values()]
      .filter(
        (row) =>
          row.status === 'active' && row.restart_at.getTime() <= now.getTime()
      )
      .map(clone);
  }

  async createAlert(
    input: Omit<
      AdminAlert,
      'id' | 'created_at' | 'acknowledged_by' | 'acknowledged_at'
    >
  ): Promise<AdminAlert> {
    const row: AdminAlert = {
      ...input,
      id: randomUUID(),
      created_at: new Date(),
      acknowledged_by: null,
      acknowledged_at: null,
    };
    this.alerts.push(row);
    return clone(row);
  }

  async listAlerts(
    filter: ListFilter
  ): Promise<{ rows: AdminAlert[]; total: number }> {
    let rows = [...this.alerts];
    if (filter.acknowledged === true) {
      rows = rows.filter((row) => row.acknowledged_at);
    } else if (filter.acknowledged === false) {
      rows = rows.filter((row) => !row.acknowledged_at);
    }
    rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return paginate(rows.map(clone), filter);
  }

  async ackAlert(id: string, actorId: string): Promise<AdminAlert | null> {
    const row = this.alerts.find((item) => item.id === id);
    if (!row) return null;
    row.acknowledged_by = actorId;
    row.acknowledged_at = new Date();
    return clone(row);
  }

  async loadContractFacts(contractId: string): Promise<ContractFacts | null> {
    const row = this.contracts.get(contractId);
    return row ? clone(row) : null;
  }

  async loadClientFacts(clientId: string): Promise<ClientFacts | null> {
    const row = this.clients.get(clientId);
    return row ? clone(row) : null;
  }

  async listOverdueNoteClients(
    overdueDays: number,
    now: Date
  ): Promise<ClientFacts[]> {
    const cutoff = addDelay(now, -overdueDays, 'days');
    return [...this.clients.values()].filter((client) => {
      if (client.birthOutcomesRecorded && client.status === 'complete')
        return false;
      if (!client.lastNoteAt) return true;
      return client.lastNoteAt.getTime() < cutoff.getTime();
    });
  }

  async listDueDateScanClients(
    daysAfter: number,
    now: Date
  ): Promise<ClientFacts[]> {
    return [...this.clients.values()].filter((client) => {
      if (client.birthOutcomesRecorded || !client.dueDate) return false;
      const trigger = addDelay(client.dueDate, daysAfter, 'days');
      return trigger.getTime() <= now.getTime();
    });
  }

  async listBabyDeliveredClients(_now: Date): Promise<ClientFacts[]> {
    return [...this.clients.values()].filter(
      (client) => client.babyDeliveredAt && !client.birthOutcomesRecorded
    );
  }

  async listHoursLowClients(
    remainingHours: number,
    remainingPct: number
  ): Promise<ClientFacts[]> {
    return [...this.clients.values()].filter((client) => {
      if (client.contractedHours == null) return false;
      const remaining = client.contractedHours - client.postpartumHours;
      const pct = client.contractedHours
        ? remaining / client.contractedHours
        : 1;
      return remaining <= remainingHours || pct <= remainingPct / 100;
    });
  }

  async listCardMissingAfterDeposit(): Promise<ClientFacts[]> {
    return [...this.clients.values()].filter(
      (client) => client.depositPaid && !client.cardOnFile
    );
  }

  async mintSigningLink(
    contractId: string,
    _clientId: string
  ): Promise<string | null> {
    return (
      this.signingLinks.get(contractId) ??
      `https://example.test/signing#invitation=${contractId}`
    );
  }

  async voidUnsignedContract(
    contractId: string
  ): Promise<ContractFacts | null> {
    const row = this.contracts.get(contractId);
    if (!row) return null;
    if (row.status === 'signed') return clone(row);
    row.status = 'voided';
    return clone(row);
  }

  async setContractRemindersStopped(
    contractId: string,
    stopped: boolean,
    _reason?: string | null
  ): Promise<ContractFacts | null> {
    const row = this.contracts.get(contractId);
    if (!row) return null;
    row.remindersStopped = stopped;
    return clone(row);
  }
}
