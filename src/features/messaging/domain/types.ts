export const DELAY_UNITS = [
  'minutes',
  'hours',
  'days',
  'business_days',
] as const;
export type DelayUnit = (typeof DELAY_UNITS)[number];

export const CHANNELS = ['email', 'dashboard', 'both'] as const;
export type MessageChannel = (typeof CHANNELS)[number];

export const RECIPIENT_ROLES = ['client', 'doula', 'admin', 'billing'] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

export const END_ACTIONS = ['void_contract', 'admin_alert', 'stop'] as const;
export type EndAction = (typeof END_ACTIONS)[number];

export const RUN_STATUSES = [
  'active',
  'paused',
  'completed',
  'canceled',
  'stopped_by_admin',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const SEND_STATUSES = [
  'sent',
  'skipped',
  'failed',
  'suppressed',
  'test',
] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const POSTPONEMENT_REASON_CODES = [
  'waiting_paycheck',
  'waiting_insurance_medicaid',
  'other',
] as const;
export type PostponementReasonCode = (typeof POSTPONEMENT_REASON_CODES)[number];

export const POSTPONEMENT_STATUSES = [
  'requested',
  'active',
  'restarted',
  'lifted',
  'extended',
  'canceled',
] as const;
export type PostponementStatus = (typeof POSTPONEMENT_STATUSES)[number];

export const MERGE_FIELDS = [
  'client_first_name',
  'client_last_name',
  'doula_name',
  'signing_link',
  'contract_sent_date',
  'cancel_date',
  'contact_email',
  'restart_date',
  'postponement_reason',
  'crm_link',
  'days_since_last_note',
  'due_date',
  'evaluation_link',
  'hours_remaining',
  'hours_contracted',
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

export type MergeContext = Partial<Record<MergeField, string>>;

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  channel: MessageChannel;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface ReminderPolicyStep {
  id: string;
  policyId: string;
  stepOrder: number;
  delayValue: number;
  delayUnit: DelayUnit;
  repeatEveryValue: number | null;
  repeatEveryUnit: DelayUnit | null;
  channel: MessageChannel;
  recipientRoles: RecipientRole[];
  templateId: string;
  templateKey?: string;
  enabled: boolean;
}

export interface ReminderPolicy {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerEvent: string;
  anchorField: string;
  stopConditions: string[];
  endAction: EndAction;
  endActionDelayValue: number | null;
  endActionDelayUnit: DelayUnit | null;
  endActionTemplateKeys: string[];
  notifyAdminEmail: boolean;
  alertAdminAfterSends: number | null;
  config: Record<string, unknown>;
  updatedBy: string | null;
  updatedAt: Date;
  steps: ReminderPolicyStep[];
}

export interface ReminderRun {
  id: string;
  policyId: string;
  policyKey: string;
  subjectType: string;
  subjectId: string;
  clientId: string | null;
  contractId: string | null;
  doulaId: string | null;
  status: RunStatus;
  anchorAt: Date;
  currentStep: number;
  nextDueAt: Date | null;
  endActionDueAt: Date | null;
  sendsCount: number;
  pauseReason: string | null;
  completedReason: string | null;
  claimedUntil: Date | null;
}

export interface ReminderSendLog {
  id: string;
  runId: string | null;
  policyKey: string;
  stepOrder: number | null;
  templateKey: string | null;
  templateVersion: number | null;
  idempotencyKey: string;
  recipientRole: RecipientRole | null;
  recipientEmail: string | null;
  channel: MessageChannel;
  status: SendStatus;
  suppressReason: string | null;
  errorClass: string | null;
  createdAt: Date;
}

export interface MessagingSettings {
  remindersEnabled: boolean;
  testRecipientOverrideEmail: string | null;
  contactEmail: string;
  adminNotificationEmail: string;
  billingNotificationEmail: string;
  evaluationLink: string | null;
}

export interface AdminAlert {
  id: string;
  type: string;
  clientId: string | null;
  contractId: string | null;
  runId: string | null;
  message: string;
  createdAt: Date;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
}

export interface ClientPostponement {
  id: string;
  clientId: string;
  contractId: string | null;
  reasonCode: PostponementReasonCode;
  reasonNote: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  startsAt: Date;
  restartAt: Date;
  maxDays: number;
  status: PostponementStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostponementEvent {
  id: string;
  postponementId: string;
  eventType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ContractReminderOverride {
  contractId: string;
  stopped: boolean;
  reason: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface ContractFacts {
  id: string;
  clientId: string;
  status: string;
  sentAt: Date | null;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string | null;
  doulaId: string | null;
  doulaName: string | null;
  doulaEmail: string | null;
  depositRequired: boolean;
  depositPaid: boolean;
  remindersStopped: boolean;
}

export interface ClientFacts {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  dueDate: Date | null;
  birthOutcomesRecorded: boolean;
  doulaId: string | null;
  doulaName: string | null;
  doulaEmail: string | null;
  lastNoteAt: Date | null;
  postpartumHoursLogged: number;
  hoursContracted: number | null;
  depositPaid: boolean;
  cardOnFile: boolean;
}

export interface TickCounts {
  suppressed?: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  endActions: number;
  postponedRestarted: number;
  scansStarted: number;
}

export type MessagingEvent =
  | {
      type: 'contract_sent';
      contractId: string;
      clientId: string;
      signingUrl: string;
      sentAt: Date;
      isResend?: boolean;
    }
  | {
      type: 'baby_delivered';
      clientId: string;
    }
  | {
      type: 'birth_outcomes_recorded';
      clientId: string;
    }
  | {
      type: 'note_created';
      clientId: string;
      activityType: string;
      createdByRole?: string;
    }
  | {
      type: 'headshot_updated';
      doulaId: string;
    }
  | {
      type: 'client_completed';
      clientId: string;
    }
  | {
      type: 'evaluation_received';
      clientId: string;
    }
  | {
      type: 'hours_logged';
      clientId: string;
    }
  | {
      type: 'deposit_paid_no_card';
      clientId: string;
      contractId?: string;
    }
  | {
      type: 'postponement_event';
      clientId: string;
      contractId?: string | null;
      postponementId: string;
      eventType: string;
    };
