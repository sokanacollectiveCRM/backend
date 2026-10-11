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
  'pending',
] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const POSTPONEMENT_REASONS = [
  'waiting_paycheck',
  'waiting_insurance_medicaid',
  'other',
] as const;
export type PostponementReason = (typeof POSTPONEMENT_REASONS)[number];

export const POSTPONEMENT_STATUSES = [
  'requested',
  'active',
  'restarted',
  'lifted',
  'extended',
  'canceled',
] as const;
export type PostponementStatus = (typeof POSTPONEMENT_STATUSES)[number];

export const ALLOWED_MERGE_FIELDS = [
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
export type MergeField = (typeof ALLOWED_MERGE_FIELDS)[number];

export type MergeContext = Partial<Record<MergeField, string>>;

export interface StopConditionRule {
  type: string;
  statuses?: string[];
  [key: string]: unknown;
}

export interface StopConditions {
  rules: StopConditionRule[];
}

export interface PolicyConfig {
  overdue_days?: number;
  days_after_due_date?: number;
  remaining_hours_threshold?: number;
  remaining_pct?: number;
  reset_anchor_on_resend?: boolean;
  [key: string]: unknown;
}

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  channel: MessageChannel;
  subject: string;
  body_text: string;
  body_html: string | null;
  version: number;
  updated_by: string | null;
  updated_at: Date;
}

export interface ReminderPolicyStep {
  id: string;
  policy_id: string;
  step_order: number;
  delay_value: number;
  delay_unit: DelayUnit;
  repeat_every_value: number | null;
  repeat_every_unit: DelayUnit | null;
  channel: MessageChannel;
  recipient_roles: RecipientRole[];
  template_id: string;
  enabled: boolean;
}

export interface ReminderPolicy {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_event: string;
  anchor_field: string;
  stop_conditions: StopConditions;
  end_action: EndAction | null;
  end_action_delay_value: number | null;
  end_action_delay_unit: DelayUnit | null;
  end_action_template_keys: string[];
  notify_admin_email: boolean;
  alert_admin_after_sends: number | null;
  config: PolicyConfig;
  updated_by: string | null;
  updated_at: Date;
}

export interface PolicyWithSteps extends ReminderPolicy {
  steps: ReminderPolicyStep[];
}

export interface ReminderRun {
  id: string;
  policy_id: string;
  policy_key: string;
  subject_type: string;
  subject_id: string;
  client_id: string | null;
  contract_id: string | null;
  doula_id: string | null;
  status: RunStatus;
  anchor_at: Date;
  current_step: number;
  next_due_at: Date | null;
  end_action_due_at: Date | null;
  sends_count: number;
  pause_reason: string | null;
  completed_reason: string | null;
  admin_alerted: boolean;
}

export interface ReminderSendLog {
  id: string;
  run_id: string | null;
  policy_key: string;
  step_order: number | null;
  template_key: string | null;
  template_version: number | null;
  idempotency_key: string;
  recipient_role: RecipientRole | null;
  recipient_email: string | null;
  channel: MessageChannel;
  status: SendStatus;
  suppress_reason: string | null;
  error_class: string | null;
  created_at: Date;
}

export interface ClientPostponement {
  id: string;
  client_id: string;
  contract_id: string | null;
  reason_code: PostponementReason;
  reason_note: string | null;
  requested_by: string | null;
  approved_by: string | null;
  starts_at: Date;
  restart_at: Date;
  max_days: number;
  status: PostponementStatus;
  warning: string | null;
}

export interface PostponementEvent {
  id: string;
  postponement_id: string;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

export interface AdminAlert {
  id: string;
  type: string;
  client_id: string | null;
  contract_id: string | null;
  run_id: string | null;
  message: string;
  created_at: Date;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
}

export interface MessagingSettings {
  reminders_enabled: boolean;
  test_recipient_override_email: string | null;
  contact_email: string;
  admin_notification_email: string;
  billing_notification_email: string;
  evaluation_link: string | null;
  overdue_days: number;
  test_tools_enabled: boolean;
}

export interface ContractFacts {
  id: string;
  clientId: string;
  status: string;
  sentAt: Date | null;
  clientEmail: string | null;
  clientFirstName: string;
  clientLastName: string;
  doulaId: string | null;
  doulaName: string | null;
  doulaEmail: string | null;
  depositDue: boolean;
  depositPaid: boolean;
  remindersStopped: boolean;
  contractedHours: number | null;
}

export interface ClientFacts {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  dueDate: Date | null;
  babyDeliveredAt: Date | null;
  birthOutcomesRecorded: boolean;
  doulaId: string | null;
  doulaName: string | null;
  doulaEmail: string | null;
  lastNoteAt: Date | null;
  cardOnFile: boolean;
  depositPaid: boolean;
  postpartumHours: number;
  contractedHours: number | null;
}

export interface TickResult {
  suppressed?: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  endActions: number;
  postponementsRestarted: number;
  scansStarted: number;
}

export interface MailerPort {
  sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string
  ): Promise<void>;
}

export interface ClockPort {
  now(): Date;
}
