import {
  AdminAlert,
  ClientFacts,
  ClientPostponement,
  ContractFacts,
  ContractReminderOverride,
  DelayUnit,
  EndAction,
  MessageTemplate,
  MessagingSettings,
  PostponementEvent,
  PostponementReasonCode,
  PostponementStatus,
  RecipientRole,
  ReminderPolicy,
  ReminderPolicyStep,
  ReminderRun,
  ReminderSendLog,
  RunStatus,
  SendStatus,
} from '../domain/types';

export interface InsertSendLogInput {
  runId: string | null;
  policyKey: string;
  stepOrder: number | null;
  templateKey: string | null;
  templateVersion: number | null;
  idempotencyKey: string;
  recipientRole: RecipientRole | null;
  recipientEmail: string | null;
  channel: ReminderSendLog['channel'];
  status: SendStatus;
  suppressReason?: string | null;
  errorClass?: string | null;
}

export class UniqueViolationError extends Error {
  readonly code = '23505';
  constructor(message = 'duplicate idempotency key') {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

export interface MessagingStore {
  getSettings(): Promise<MessagingSettings>;
  updateSettings(
    patch: Partial<MessagingSettings>
  ): Promise<MessagingSettings>;

  listPolicies(): Promise<ReminderPolicy[]>;
  getPolicyById(id: string): Promise<ReminderPolicy | null>;
  getPolicyByKey(key: string): Promise<ReminderPolicy | null>;
  updatePolicy(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      enabled: boolean;
      stopConditions: string[];
      endAction: EndAction;
      endActionDelayValue: number | null;
      endActionDelayUnit: DelayUnit | null;
      endActionTemplateKeys: string[];
      notifyAdminEmail: boolean;
      alertAdminAfterSends: number | null;
      config: Record<string, unknown>;
      updatedBy: string | null;
    }>
  ): Promise<ReminderPolicy>;
  replaceSteps(
    policyId: string,
    steps: Omit<ReminderPolicyStep, 'id' | 'policyId'>[]
  ): Promise<ReminderPolicyStep[]>;

  listTemplates(): Promise<MessageTemplate[]>;
  getTemplateById(id: string): Promise<MessageTemplate | null>;
  getTemplateByKey(key: string): Promise<MessageTemplate | null>;
  updateTemplate(
    id: string,
    patch: Partial<{
      name: string;
      channel: MessageTemplate['channel'];
      subject: string;
      bodyText: string;
      bodyHtml: string;
      updatedBy: string | null;
    }>
  ): Promise<MessageTemplate>;

  createRun(
    input: Omit<ReminderRun, 'id' | 'claimedUntil'> & { id?: string }
  ): Promise<ReminderRun>;
  getRunById(id: string): Promise<ReminderRun | null>;
  findOpenRun(
    policyId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ReminderRun | null>;
  listRuns(filters: {
    status?: RunStatus | RunStatus[];
    policyKey?: string;
    clientId?: string;
    contractId?: string;
  }): Promise<ReminderRun[]>;
  updateRun(id: string, patch: Partial<ReminderRun>): Promise<ReminderRun>;
  claimDueRuns(now: Date, limit: number): Promise<ReminderRun[]>;
  pauseRunsForSubject(input: {
    clientId?: string | null;
    contractId?: string | null;
    reason: string;
  }): Promise<ReminderRun[]>;

  insertSendLog(input: InsertSendLogInput): Promise<ReminderSendLog>;
  findSendLogByKey(idempotencyKey: string): Promise<ReminderSendLog | null>;
  listSendLog(input: {
    limit: number;
    offset: number;
    policyKey?: string;
    status?: SendStatus;
  }): Promise<{ rows: ReminderSendLog[]; total: number }>;
  countSendsForRunStep(runId: string, stepOrder: number): Promise<number>;

  createAlert(input: {
    type: string;
    clientId?: string | null;
    contractId?: string | null;
    runId?: string | null;
    message: string;
  }): Promise<AdminAlert>;
  listAlerts(unacknowledgedOnly?: boolean): Promise<AdminAlert[]>;
  acknowledgeAlert(id: string, actorId: string): Promise<AdminAlert | null>;

  getContractOverride(
    contractId: string
  ): Promise<ContractReminderOverride | null>;
  upsertContractOverride(
    input: ContractReminderOverride
  ): Promise<ContractReminderOverride>;

  getContractFacts(contractId: string): Promise<ContractFacts | null>;
  getClientFacts(clientId: string): Promise<ClientFacts | null>;
  listDueDateScanCandidates(now: Date, daysAfter: number): Promise<ClientFacts[]>;
  listOverdueNoteCandidates(now: Date, overdueDays: number): Promise<ClientFacts[]>;
  listHoursLowCandidates(thresholdHours: number, remainingPct: number): Promise<ClientFacts[]>;
  listDepositPaidNoCardCandidates(): Promise<ClientFacts[]>;
  listDoulaEmail(doulaId: string): Promise<{ email: string | null; name: string } | null>;

  createPostponement(input: {
    clientId: string;
    contractId?: string | null;
    reasonCode: PostponementReasonCode;
    reasonNote?: string | null;
    requestedBy?: string | null;
    approvedBy?: string | null;
    startsAt: Date;
    restartAt: Date;
    maxDays: number;
    status: PostponementStatus;
  }): Promise<ClientPostponement>;
  getPostponement(id: string): Promise<ClientPostponement | null>;
  listPostponements(clientId: string): Promise<ClientPostponement[]>;
  listActivePostponementsDue(now: Date): Promise<ClientPostponement[]>;
  findActivePostponement(input: {
    clientId?: string | null;
    contractId?: string | null;
  }): Promise<ClientPostponement | null>;
  updatePostponement(
    id: string,
    patch: Partial<ClientPostponement>
  ): Promise<ClientPostponement>;
  appendPostponementEvent(input: {
    postponementId: string;
    eventType: string;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<PostponementEvent>;
  listPostponementEvents(postponementId: string): Promise<PostponementEvent[]>;
}
