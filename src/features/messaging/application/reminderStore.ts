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
  RunStatus,
  SendStatus,
} from '../domain/types';

export interface CreateRunInput {
  policy: ReminderPolicy;
  subjectType: string;
  subjectId: string;
  clientId?: string | null;
  contractId?: string | null;
  doulaId?: string | null;
  status: RunStatus;
  anchorAt: Date;
  currentStep: number;
  nextDueAt: Date | null;
  endActionDueAt: Date | null;
  pauseReason?: string | null;
}

export interface SendLogInsert {
  runId: string | null;
  policyKey: string;
  stepOrder: number | null;
  templateKey: string | null;
  templateVersion: number | null;
  idempotencyKey: string;
  recipientRole: string | null;
  recipientEmail: string | null;
  channel: string;
  status: SendStatus;
  suppressReason?: string | null;
  errorClass?: string | null;
}

export interface ListFilter {
  status?: string;
  policyKey?: string;
  clientId?: string;
  contractId?: string;
  page?: number;
  pageSize?: number;
  acknowledged?: boolean;
}

export interface ReminderStore {
  getSettings(): Promise<MessagingSettings>;
  updateSettings(
    patch: Partial<
      Omit<MessagingSettings, 'overdue_days' | 'test_tools_enabled'>
    >,
    actorId: string | null
  ): Promise<MessagingSettings>;

  listPolicies(): Promise<PolicyWithSteps[]>;
  getPolicy(id: string): Promise<PolicyWithSteps | null>;
  getPolicyByKey(key: string): Promise<PolicyWithSteps | null>;
  updatePolicy(
    id: string,
    patch: Partial<ReminderPolicy>,
    actorId: string | null
  ): Promise<PolicyWithSteps | null>;
  replaceSteps(
    id: string,
    steps: Array<Omit<ReminderPolicyStep, 'id' | 'policy_id'>>,
    actorId: string | null
  ): Promise<PolicyWithSteps | null>;

  listTemplates(): Promise<MessageTemplate[]>;
  getTemplate(id: string): Promise<MessageTemplate | null>;
  getTemplateByKey(key: string): Promise<MessageTemplate | null>;
  updateTemplate(
    id: string,
    patch: Partial<
      Pick<
        MessageTemplate,
        'name' | 'channel' | 'subject' | 'body_text' | 'body_html'
      >
    >,
    actorId: string | null
  ): Promise<MessageTemplate | null>;

  findActiveOrPausedRun(
    policyId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ReminderRun | null>;
  getRun(id: string): Promise<ReminderRun | null>;
  createRun(input: CreateRunInput): Promise<ReminderRun>;
  updateRun(
    id: string,
    patch: Partial<ReminderRun>
  ): Promise<ReminderRun | null>;
  listRuns(filter: ListFilter): Promise<{ rows: ReminderRun[]; total: number }>;
  listRunsForContract(contractId: string): Promise<ReminderRun[]>;
  pauseRunsForClient(
    clientId: string,
    contractId: string | null,
    reason: string
  ): Promise<number>;
  claimDueRuns(now: Date, limit: number): Promise<ReminderRun[]>;

  tryInsertSendLog(
    entry: SendLogInsert
  ): Promise<ReminderSendLog | 'duplicate'>;
  updateSendLog(
    id: string,
    patch: Partial<
      Pick<ReminderSendLog, 'status' | 'error_class' | 'suppress_reason'>
    >
  ): Promise<void>;
  listSendLog(
    filter: ListFilter
  ): Promise<{ rows: ReminderSendLog[]; total: number }>;
  countSendsForRunStep(
    runId: string,
    stepOrder: number,
    statuses?: SendStatus[]
  ): Promise<number>;

  listPostponements(clientId: string): Promise<ClientPostponement[]>;
  getPostponement(id: string): Promise<ClientPostponement | null>;
  createPostponement(
    input: Omit<ClientPostponement, 'id' | 'warning'> & {
      warning?: string | null;
    }
  ): Promise<ClientPostponement>;
  updatePostponement(
    id: string,
    patch: Partial<ClientPostponement>
  ): Promise<ClientPostponement | null>;
  appendPostponementEvent(
    input: Omit<PostponementEvent, 'id' | 'created_at'>
  ): Promise<PostponementEvent>;
  findActivePostponement(
    clientId: string,
    contractId?: string | null
  ): Promise<ClientPostponement | null>;
  listDuePostponementRestarts(now: Date): Promise<ClientPostponement[]>;

  createAlert(
    input: Omit<
      AdminAlert,
      'id' | 'created_at' | 'acknowledged_by' | 'acknowledged_at'
    >
  ): Promise<AdminAlert>;
  listAlerts(
    filter: ListFilter
  ): Promise<{ rows: AdminAlert[]; total: number }>;
  ackAlert(id: string, actorId: string): Promise<AdminAlert | null>;

  loadContractFacts(contractId: string): Promise<ContractFacts | null>;
  loadClientFacts(clientId: string): Promise<ClientFacts | null>;
  listOverdueNoteClients(
    overdueDays: number,
    now: Date
  ): Promise<ClientFacts[]>;
  listDueDateScanClients(daysAfter: number, now: Date): Promise<ClientFacts[]>;
  listBabyDeliveredClients(now: Date): Promise<ClientFacts[]>;
  listHoursLowClients(
    remainingHours: number,
    remainingPct: number
  ): Promise<ClientFacts[]>;
  listCardMissingAfterDeposit(): Promise<ClientFacts[]>;
  mintSigningLink(contractId: string, clientId: string): Promise<string | null>;
  voidUnsignedContract(contractId: string): Promise<ContractFacts | null>;
  setContractRemindersStopped(
    contractId: string,
    stopped: boolean,
    reason?: string | null
  ): Promise<ContractFacts | null>;
}
