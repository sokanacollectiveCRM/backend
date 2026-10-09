import { randomUUID } from 'crypto';

import {
  MessageTemplate,
  ReminderPolicy,
  ReminderPolicyStep,
} from '../domain/types';
import { MessagingStore } from './store';

function template(
  key: string,
  name: string,
  subject: string,
  body: string,
  channel: MessageTemplate['channel'] = 'email'
): MessageTemplate {
  const now = new Date();
  return {
    id: randomUUID(),
    key,
    name,
    channel,
    subject,
    bodyText: body,
    bodyHtml: `<p>${body.replace(/\n+/g, '</p><p>')}</p>`,
    version: 1,
    updatedBy: null,
    updatedAt: now,
  };
}

function step(
  policyId: string,
  order: number,
  delayValue: number,
  delayUnit: ReminderPolicyStep['delayUnit'],
  roles: ReminderPolicyStep['recipientRoles'],
  templateId: string,
  extra: Partial<ReminderPolicyStep> = {}
): ReminderPolicyStep {
  return {
    id: randomUUID(),
    policyId,
    stepOrder: order,
    delayValue,
    delayUnit,
    repeatEveryValue: extra.repeatEveryValue ?? null,
    repeatEveryUnit: extra.repeatEveryUnit ?? null,
    channel: extra.channel ?? 'email',
    recipientRoles: roles,
    templateId,
    enabled: extra.enabled ?? true,
  };
}

export function buildDefaultSeed(): {
  templates: MessageTemplate[];
  policies: ReminderPolicy[];
} {
  const templates = [
    template(
      'contract_sent_initial',
      'Contract sent (sign-by date)',
      'Please review and sign by {{cancel_date}}: your Sokana agreement',
      "Please sign by {{cancel_date}} to reserve your doula; if it isn't signed by then we can't guarantee your doula's availability. {{signing_link}} Contact: {{contact_email}}"
    ),
    template(
      'contract_signing_reminder_day3',
      'Contract signing reminder (day 3)',
      'Checking in about your Sokana agreement',
      "We see you haven't signed yet; do you have any questions? We can hold your doula until {{cancel_date}}; if it isn't signed and your deposit paid by then, we'll need to release your doula. {{signing_link}}"
    ),
    template(
      'contract_signing_doula_nudge',
      'Unsigned contract — doula nudge',
      "{{client_first_name}} hasn't signed yet",
      "{{client_first_name}} hasn't signed yet; feel free to check in."
    ),
    template(
      'contract_canceled_unsigned',
      'Unsigned contract canceled',
      'Your Sokana agreement has been canceled',
      'Your agreement has been canceled. If you still want services or have any questions, please reach out to {{contact_email}}.'
    ),
    template(
      'birth_outcomes_reminder',
      'Birth outcomes reminder',
      'Birth outcomes needed before payout',
      "Please complete birth outcomes and notes for {{client_first_name}}. Payout can't be submitted until outcomes and notes are complete.",
      'both'
    ),
    template(
      'overdue_notes_doula',
      'Overdue notes — doula',
      'Please add a note for {{client_first_name}}',
      'It has been {{days_since_last_note}} days. The admin team has also been notified.'
    ),
    template(
      'overdue_notes_admin',
      'Overdue notes — admin',
      'Overdue notes: {{client_first_name}}',
      'A note is overdue for {{client_first_name}} ({{days_since_last_note}} days).'
    ),
    template(
      'service_completed_evaluation',
      'Service complete — evaluation',
      'How was your Sokana experience?',
      'Please share feedback: {{evaluation_link}}'
    ),
    template(
      'evaluation_received_admin',
      'Evaluation received',
      'A client evaluation was received',
      'An evaluation was submitted for {{client_first_name}}. No answers or clinical details are included.',
      'both'
    ),
    template(
      'postpartum_hours_low',
      'Postpartum hours running low',
      'Your postpartum hours are running low',
      'You have about {{hours_remaining}} hours remaining of {{hours_contracted}} contracted postpartum hours.'
    ),
    template(
      'card_not_on_file_billing',
      'Card not on file',
      'Card not on file after deposit: {{client_first_name}}',
      'A deposit was received for {{client_first_name}}, but no stored card was detected.'
    ),
    template(
      'doula_interview_logged_admin',
      'Doula interview logged',
      'Interview logged for {{client_first_name}}',
      'A doula logged an interview note for {{client_first_name}}.'
    ),
    template(
      'admin_note_added_doula',
      'Admin added a note',
      'New admin note for {{client_first_name}}',
      'An admin added a note for {{client_first_name}}.'
    ),
    template(
      'headshot_updated_admin',
      'Headshot updated — approve',
      'A doula updated their headshot',
      'A doula updated their profile photo and it needs review.'
    ),
    template(
      'postponement_paused_doula',
      'Reminders postponed',
      'Reminders paused for {{client_first_name}}',
      'Reminders for {{client_first_name}} are paused until {{restart_date}} ({{postponement_reason}}).'
    ),
    template(
      'routine_update_dashboard',
      'Routine update (dashboard only)',
      'Update',
      'A routine update is available in the CRM for {{client_first_name}}.',
      'dashboard'
    ),
  ];

  const byKey = new Map(templates.map((t) => [t.key, t]));
  const idOf = (key: string) => byKey.get(key)!.id;

  const signingId = randomUUID();
  const birthId = randomUUID();
  const notesId = randomUUID();
  const evalId = randomUUID();
  const evalRecvId = randomUUID();
  const hoursId = randomUUID();
  const cardId = randomUUID();
  const interviewId = randomUUID();
  const adminNoteId = randomUUID();
  const headshotId = randomUUID();
  const routineId = randomUUID();
  const postponeId = randomUUID();
  const now = new Date();

  const policies: ReminderPolicy[] = [
    {
      id: signingId,
      key: 'contract_signing',
      name: 'Contract signing',
      description: 'Day 3 reminder + doula nudge; day 7 cancel if unsigned.',
      enabled: true,
      triggerEvent: 'contract_sent',
      anchorField: 'sent_at',
      stopConditions: [
        'signed_and_deposit_paid',
        'declined',
        'voided',
        'expired',
        'stopped_by_admin',
      ],
      endAction: 'void_contract',
      endActionDelayValue: 7,
      endActionDelayUnit: 'days',
      endActionTemplateKeys: ['contract_canceled_unsigned'],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: { reset_anchor_on_resend: false, initial_via_event: true },
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          signingId,
          0,
          0,
          'days',
          ['client'],
          idOf('contract_sent_initial')
        ),
        step(
          signingId,
          1,
          3,
          'days',
          ['client'],
          idOf('contract_signing_reminder_day3')
        ),
        step(
          signingId,
          2,
          3,
          'days',
          ['doula'],
          idOf('contract_signing_doula_nudge')
        ),
      ],
    },
    {
      id: birthId,
      key: 'birth_outcomes',
      name: 'Birth outcomes',
      description: 'Due date + 5 days.',
      enabled: true,
      triggerEvent: 'due_date_elapsed',
      anchorField: 'due_date',
      stopConditions: ['birth_outcomes_recorded'],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: 3,
      config: { days_after_due_date: 5 },
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          birthId,
          0,
          0,
          'days',
          ['doula'],
          idOf('birth_outcomes_reminder'),
          {
            channel: 'both',
            repeatEveryValue: 48,
            repeatEveryUnit: 'hours',
          }
        ),
      ],
    },
    {
      id: notesId,
      key: 'overdue_notes',
      name: 'Overdue notes',
      description: 'No note for N days.',
      enabled: true,
      triggerEvent: 'overdue_notes_scan',
      anchorField: 'last_note_at',
      stopConditions: ['note_created'],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: { overdue_days: 7 },
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(notesId, 0, 0, 'days', ['doula'], idOf('overdue_notes_doula'), {
          repeatEveryValue: 7,
          repeatEveryUnit: 'days',
        }),
        step(notesId, 1, 0, 'days', ['admin'], idOf('overdue_notes_admin'), {
          repeatEveryValue: 7,
          repeatEveryUnit: 'days',
        }),
      ],
    },
    {
      id: evalId,
      key: 'service_completed_evaluation',
      name: 'Service completed — evaluation',
      description: 'Disabled until completion workflow exists.',
      enabled: false,
      triggerEvent: 'client_completed',
      anchorField: 'completed_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          evalId,
          0,
          0,
          'days',
          ['client'],
          idOf('service_completed_evaluation')
        ),
      ],
    },
    {
      id: evalRecvId,
      key: 'evaluation_received',
      name: 'Evaluation received',
      description: 'Disabled until in-system form exists.',
      enabled: false,
      triggerEvent: 'evaluation_received',
      anchorField: 'received_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: true,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          evalRecvId,
          0,
          0,
          'days',
          ['admin'],
          idOf('evaluation_received_admin'),
          {
            channel: 'both',
          }
        ),
      ],
    },
    {
      id: hoursId,
      key: 'postpartum_hours_low',
      name: 'Postpartum hours low',
      description: 'Disabled until hours tracking exists.',
      enabled: false,
      triggerEvent: 'hours_threshold',
      anchorField: 'hours_logged_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: { remaining_hours_threshold: 4, remaining_pct: 20 },
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(hoursId, 0, 0, 'days', ['client'], idOf('postpartum_hours_low')),
      ],
    },
    {
      id: cardId,
      key: 'card_not_on_file',
      name: 'Card not on file',
      description: 'Disabled until card detection is wired.',
      enabled: false,
      triggerEvent: 'deposit_paid_no_card',
      anchorField: 'deposit_paid_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          cardId,
          0,
          0,
          'days',
          ['billing'],
          idOf('card_not_on_file_billing')
        ),
      ],
    },
    {
      id: interviewId,
      key: 'doula_interview_logged',
      name: 'Doula interview logged',
      description: 'Disabled until enabled in the UI.',
      enabled: false,
      triggerEvent: 'doula_interview_logged',
      anchorField: 'logged_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: true,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          interviewId,
          0,
          0,
          'days',
          ['admin'],
          idOf('doula_interview_logged_admin')
        ),
      ],
    },
    {
      id: adminNoteId,
      key: 'admin_note_added',
      name: 'Admin added a note',
      description: 'Email the assigned doula.',
      enabled: true,
      triggerEvent: 'admin_note_added',
      anchorField: 'note_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          adminNoteId,
          0,
          0,
          'days',
          ['doula'],
          idOf('admin_note_added_doula')
        ),
      ],
    },
    {
      id: headshotId,
      key: 'headshot_updated',
      name: 'Headshot updated',
      description: 'Admin approve notice.',
      enabled: true,
      triggerEvent: 'headshot_updated',
      anchorField: 'updated_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: true,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          headshotId,
          0,
          0,
          'days',
          ['admin'],
          idOf('headshot_updated_admin')
        ),
      ],
    },
    {
      id: routineId,
      key: 'routine_update',
      name: 'Routine updates',
      description: 'Dashboard only.',
      enabled: true,
      triggerEvent: 'routine_update',
      anchorField: 'updated_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          routineId,
          0,
          0,
          'days',
          ['admin'],
          idOf('routine_update_dashboard'),
          {
            channel: 'dashboard',
          }
        ),
      ],
    },
    {
      id: postponeId,
      key: 'postponement_notice',
      name: 'Postponement notice',
      description: 'Notify the assigned doula.',
      enabled: true,
      triggerEvent: 'postponement_event',
      anchorField: 'starts_at',
      stopConditions: [],
      endAction: 'stop',
      endActionDelayValue: null,
      endActionDelayUnit: null,
      endActionTemplateKeys: [],
      notifyAdminEmail: false,
      alertAdminAfterSends: null,
      config: {},
      updatedBy: null,
      updatedAt: now,
      steps: [
        step(
          postponeId,
          0,
          0,
          'days',
          ['doula'],
          idOf('postponement_paused_doula')
        ),
      ],
    },
  ];

  return { templates, policies };
}

export async function loadDefaultSeed(store: MessagingStore): Promise<void> {
  const seed = buildDefaultSeed();
  if ('templates' in store && Array.isArray((store as any).templates)) {
    (store as any).templates = seed.templates;
    (store as any).policies = seed.policies;
  }
}
