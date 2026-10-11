import {
  MessageChannel,
  MessageTemplate,
  ReminderPolicy,
  ReminderPolicyStep,
} from '../domain/types';
import { InMemoryReminderStore } from '../infrastructure/inMemoryReminderStore';

const now = () => new Date('2026-10-09T00:00:00.000Z');

export const TEMPLATE_IDS = {
  contract_sent_initial: 'a1111111-1111-4111-8111-111111111101',
  contract_signing_reminder_day3: 'a1111111-1111-4111-8111-111111111102',
  contract_signing_doula_nudge: 'a1111111-1111-4111-8111-111111111103',
  contract_canceled_unsigned: 'a1111111-1111-4111-8111-111111111104',
  birth_outcomes_doula: 'a1111111-1111-4111-8111-111111111105',
  overdue_notes_doula: 'a1111111-1111-4111-8111-111111111106',
  overdue_notes_admin: 'a1111111-1111-4111-8111-111111111107',
  service_completed_evaluation: 'a1111111-1111-4111-8111-111111111108',
  evaluation_received_admin: 'a1111111-1111-4111-8111-111111111109',
  postpartum_hours_low: 'a1111111-1111-4111-8111-111111111110',
  card_not_on_file_billing: 'a1111111-1111-4111-8111-111111111111',
  doula_interview_logged_admin: 'a1111111-1111-4111-8111-111111111112',
  admin_note_added_doula: 'a1111111-1111-4111-8111-111111111113',
  headshot_updated_admin: 'a1111111-1111-4111-8111-111111111114',
  postponement_doula: 'a1111111-1111-4111-8111-111111111115',
  routine_update_dashboard: 'a1111111-1111-4111-8111-111111111116',
} as const;

export const POLICY_IDS = {
  contract_signing: 'b2222222-2222-4222-8222-222222222201',
  birth_outcomes: 'b2222222-2222-4222-8222-222222222202',
  overdue_notes: 'b2222222-2222-4222-8222-222222222203',
  service_completed_evaluation: 'b2222222-2222-4222-8222-222222222204',
  evaluation_received: 'b2222222-2222-4222-8222-222222222205',
  postpartum_hours_low: 'b2222222-2222-4222-8222-222222222206',
  card_not_on_file: 'b2222222-2222-4222-8222-222222222207',
  doula_interview_logged: 'b2222222-2222-4222-8222-222222222208',
  admin_note_added: 'b2222222-2222-4222-8222-222222222209',
  headshot_updated: 'b2222222-2222-4222-8222-222222222210',
  routine_updates: 'b2222222-2222-4222-8222-222222222211',
  postponement_events: 'b2222222-2222-4222-8222-222222222212',
} as const;

function template(
  id: string,
  key: string,
  name: string,
  subject: string,
  body: string,
  channel: MessageChannel = 'email'
): MessageTemplate {
  return {
    id,
    key,
    name,
    channel,
    subject,
    body_text: body,
    body_html: null,
    version: 1,
    updated_by: null,
    updated_at: now(),
  };
}

function policy(input: ReminderPolicy): ReminderPolicy {
  return input;
}

function step(
  policyId: string,
  order: number,
  delayValue: number,
  delayUnit: ReminderPolicyStep['delay_unit'],
  roles: ReminderPolicyStep['recipient_roles'],
  templateId: string,
  extras: Partial<ReminderPolicyStep> = {}
): ReminderPolicyStep {
  return {
    id: randomStepId(policyId, order, roles[0] || 'client'),
    policy_id: policyId,
    step_order: order,
    delay_value: delayValue,
    delay_unit: delayUnit,
    repeat_every_value: null,
    repeat_every_unit: null,
    channel: 'email',
    recipient_roles: roles,
    template_id: templateId,
    enabled: true,
    ...extras,
  };
}

function randomStepId(policyId: string, order: number, role: string): string {
  const roleCode =
    { client: 'c', doula: 'd', admin: 'a', billing: 'b' }[role] || 'x';
  const policyTail = policyId.slice(-4);
  const suffix = `${policyTail}${order}${roleCode}`
    .padEnd(12, '0')
    .slice(0, 12);
  return `c3333333-3333-4333-8333-${suffix}`;
}

export function seedInMemoryMessaging(store: InMemoryReminderStore): void {
  const templates: MessageTemplate[] = [
    template(
      TEMPLATE_IDS.contract_sent_initial,
      'contract_sent_initial',
      'Contract sent (sign-by date)',
      'Please sign your Sokana agreement by {{cancel_date}}',
      "Hello {{client_first_name}},\n\nPlease sign by {{cancel_date}} to reserve your doula; if it isn't signed by then we can't guarantee your doula's availability.\n\nSign here: {{signing_link}}\n\nSokana Collective"
    ),
    template(
      TEMPLATE_IDS.contract_signing_reminder_day3,
      'contract_signing_reminder_day3',
      'Day 3 signing reminder',
      'A reminder to sign your Sokana agreement',
      "Hello {{client_first_name}},\n\nWe see you haven't signed yet; do you have any questions?\n\nWe can hold your doula until {{cancel_date}}; if it isn't signed and your deposit paid by then, we'll need to release your doula.\n\nSign here: {{signing_link}}\n\nSokana Collective"
    ),
    template(
      TEMPLATE_IDS.contract_signing_doula_nudge,
      'contract_signing_doula_nudge',
      'Day 3 doula nudge',
      '{{client_first_name}} has not signed yet',
      "{{client_first_name}} hasn't signed yet; feel free to check in."
    ),
    template(
      TEMPLATE_IDS.contract_canceled_unsigned,
      'contract_canceled_unsigned',
      'Unsigned contract canceled',
      'Your Sokana agreement has been canceled',
      'Hello {{client_first_name}},\n\nYour agreement has been canceled. If you still want services or have any questions, please reach out to {{contact_email}}.\n\nSokana Collective'
    ),
    template(
      TEMPLATE_IDS.birth_outcomes_doula,
      'birth_outcomes_doula',
      'Birth outcomes reminder',
      'Birth outcomes needed before payout',
      "Hello {{doula_name}},\n\nPlease complete birth outcomes and notes for {{client_first_name}}. Payout can't be submitted until outcomes and notes are complete.\n\n{{crm_link}}"
    ),
    template(
      TEMPLATE_IDS.overdue_notes_doula,
      'overdue_notes_doula',
      'Overdue notes (doula)',
      'Client notes are overdue',
      'Hello {{doula_name}},\n\nIt has been {{days_since_last_note}} days since the last note for {{client_first_name}}. An admin has been notified.\n\n{{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.overdue_notes_admin,
      'overdue_notes_admin',
      'Overdue notes (admin)',
      'Overdue notes: {{client_first_name}}',
      'Notes for {{client_first_name}} are overdue ({{days_since_last_note}} days). {{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.service_completed_evaluation,
      'service_completed_evaluation',
      'Service completed evaluation',
      'Please share feedback on your Sokana care',
      'Hello {{client_first_name}},\n\nWe would love your feedback: {{evaluation_link}}'
    ),
    template(
      TEMPLATE_IDS.evaluation_received_admin,
      'evaluation_received_admin',
      'Evaluation received',
      'A client evaluation was received',
      'An evaluation was submitted. Open the CRM to review (no answers are included in this email). {{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.postpartum_hours_low,
      'postpartum_hours_low',
      'Postpartum hours running low',
      'Your remaining postpartum hours are running low',
      'Hello {{client_first_name}},\n\nYou have about {{hours_remaining}} of {{hours_contracted}} contracted postpartum hours remaining. Reach out to {{contact_email}} with questions.'
    ),
    template(
      TEMPLATE_IDS.card_not_on_file_billing,
      'card_not_on_file_billing',
      'Card not on file',
      'Deposit paid but no card on file',
      'A client deposit was recorded but no stored card was detected. {{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.doula_interview_logged_admin,
      'doula_interview_logged_admin',
      'Doula interview logged',
      'Interview note logged for {{client_first_name}}',
      'A doula logged an interview note for {{client_first_name}}. {{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.admin_note_added_doula,
      'admin_note_added_doula',
      'Admin added a note',
      'New admin note for {{client_first_name}}',
      'An admin added a note for {{client_first_name}}. {{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.headshot_updated_admin,
      'headshot_updated_admin',
      'Headshot updated',
      'A doula headshot needs review',
      'A doula updated their headshot and it is ready for approval. {{crm_link}}'
    ),
    template(
      TEMPLATE_IDS.postponement_doula,
      'postponement_doula',
      'Postponement notice',
      'Reminders postponed for {{client_first_name}}',
      'Reminders for {{client_first_name}} are paused until {{restart_date}} ({{postponement_reason}}). They will restart automatically.'
    ),
    template(
      TEMPLATE_IDS.routine_update_dashboard,
      'routine_update_dashboard',
      'Routine update',
      'Routine update',
      'A routine client update is available in the dashboard. {{crm_link}}',
      'dashboard'
    ),
  ];
  for (const row of templates) store.templates.set(row.id, row);

  const policies: Array<{
    policy: ReminderPolicy;
    steps: ReminderPolicyStep[];
  }> = [
    {
      policy: policy({
        id: POLICY_IDS.contract_signing,
        key: 'contract_signing',
        name: 'Contract signing',
        description:
          'Day 3 client reminder + doula nudge; day 7 cancel if unsigned. A signed contract is never auto-canceled.',
        enabled: true,
        trigger_event: 'contract_sent',
        anchor_field: 'sent_at',
        stop_conditions: {
          rules: [
            { type: 'signed_and_deposit_paid' },
            {
              type: 'contract_status_in',
              statuses: ['declined', 'voided', 'expired'],
            },
            { type: 'reminders_stopped' },
          ],
        },
        end_action: 'void_contract',
        end_action_delay_value: 7,
        end_action_delay_unit: 'days',
        end_action_template_keys: ['contract_canceled_unsigned'],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: { reset_anchor_on_resend: false },
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.contract_signing,
          1,
          3,
          'days',
          ['client'],
          TEMPLATE_IDS.contract_signing_reminder_day3
        ),
        step(
          POLICY_IDS.contract_signing,
          2,
          3,
          'days',
          ['doula'],
          TEMPLATE_IDS.contract_signing_doula_nudge
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.birth_outcomes,
        key: 'birth_outcomes',
        name: 'Birth outcomes',
        description:
          'Remind the doula at estimated due date + 5 days until outcomes are logged.',
        enabled: true,
        trigger_event: 'due_date_elapsed',
        anchor_field: 'due_date',
        stop_conditions: { rules: [{ type: 'birth_outcomes_recorded' }] },
        end_action: 'admin_alert',
        end_action_delay_value: null,
        end_action_delay_unit: null,
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: 3,
        config: { days_after_due_date: 5 },
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.birth_outcomes,
          1,
          0,
          'days',
          ['doula'],
          TEMPLATE_IDS.birth_outcomes_doula,
          {
            channel: 'both',
            repeat_every_value: 48,
            repeat_every_unit: 'hours',
          }
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.overdue_notes,
        key: 'overdue_notes',
        name: 'Overdue notes',
        description: 'Notify doula and admin when notes are stale.',
        enabled: true,
        trigger_event: 'notes_overdue_scan',
        anchor_field: 'last_note_at',
        stop_conditions: { rules: [{ type: 'note_created' }] },
        end_action: 'stop',
        end_action_delay_value: null,
        end_action_delay_unit: null,
        end_action_template_keys: [],
        notify_admin_email: true,
        alert_admin_after_sends: null,
        config: { overdue_days: 7 },
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.overdue_notes,
          1,
          0,
          'days',
          ['doula'],
          TEMPLATE_IDS.overdue_notes_doula
        ),
        step(
          POLICY_IDS.overdue_notes,
          2,
          0,
          'days',
          ['admin'],
          TEMPLATE_IDS.overdue_notes_admin
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.service_completed_evaluation,
        key: 'service_completed_evaluation',
        name: 'Service completed evaluation',
        description: 'Send evaluation link when a client is marked complete.',
        enabled: false,
        trigger_event: 'client_completed',
        anchor_field: 'completed_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.service_completed_evaluation,
          1,
          0,
          'days',
          ['client'],
          TEMPLATE_IDS.service_completed_evaluation
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.evaluation_received,
        key: 'evaluation_received',
        name: 'Evaluation received',
        description:
          'Notify admins when an evaluation is submitted (no answers).',
        enabled: false,
        trigger_event: 'evaluation_received',
        anchor_field: 'received_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: true,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.evaluation_received,
          1,
          0,
          'days',
          ['admin'],
          TEMPLATE_IDS.evaluation_received_admin,
          { channel: 'both' }
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.postpartum_hours_low,
        key: 'postpartum_hours_low',
        name: 'Postpartum hours low',
        description:
          'Email the client when remaining postpartum hours are low.',
        enabled: false,
        trigger_event: 'hours_logged',
        anchor_field: 'hours_logged_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: { remaining_hours_threshold: 4, remaining_pct: 20 },
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.postpartum_hours_low,
          1,
          0,
          'days',
          ['client'],
          TEMPLATE_IDS.postpartum_hours_low
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.card_not_on_file,
        key: 'card_not_on_file',
        name: 'Card not on file',
        description:
          'Alert billing when a deposit is paid but no stored card exists.',
        enabled: false,
        trigger_event: 'deposit_paid_no_card',
        anchor_field: 'deposit_paid_at',
        stop_conditions: { rules: [{ type: 'card_on_file' }] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.card_not_on_file,
          1,
          0,
          'days',
          ['billing'],
          TEMPLATE_IDS.card_not_on_file_billing
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.doula_interview_logged,
        key: 'doula_interview_logged',
        name: 'Doula interview logged',
        description: 'Email admin when a doula logs an interview note.',
        enabled: false,
        trigger_event: 'interview_logged',
        anchor_field: 'logged_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: true,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.doula_interview_logged,
          1,
          0,
          'days',
          ['admin'],
          TEMPLATE_IDS.doula_interview_logged_admin
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.admin_note_added,
        key: 'admin_note_added',
        name: 'Admin note added',
        description: 'Email the assigned doula when an admin adds a note.',
        enabled: true,
        trigger_event: 'admin_note_added',
        anchor_field: 'note_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.admin_note_added,
          1,
          0,
          'days',
          ['doula'],
          TEMPLATE_IDS.admin_note_added_doula
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.headshot_updated,
        key: 'headshot_updated',
        name: 'Headshot updated',
        description: 'Notify admin to approve a new doula headshot.',
        enabled: true,
        trigger_event: 'headshot_updated',
        anchor_field: 'updated_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: true,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.headshot_updated,
          1,
          0,
          'days',
          ['admin'],
          TEMPLATE_IDS.headshot_updated_admin
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.routine_updates,
        key: 'routine_updates',
        name: 'Routine updates',
        description: 'Dashboard-only notice for routine client updates.',
        enabled: true,
        trigger_event: 'routine_update',
        anchor_field: 'updated_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.routine_updates,
          1,
          0,
          'days',
          ['admin'],
          TEMPLATE_IDS.routine_update_dashboard,
          { channel: 'dashboard' }
        ),
      ],
    },
    {
      policy: policy({
        id: POLICY_IDS.postponement_events,
        key: 'postponement_events',
        name: 'Postponement events',
        description: 'Notify the doula when reminders are postponed.',
        enabled: true,
        trigger_event: 'postponement_changed',
        anchor_field: 'starts_at',
        stop_conditions: { rules: [] },
        end_action: 'stop',
        end_action_delay_value: 0,
        end_action_delay_unit: 'days',
        end_action_template_keys: [],
        notify_admin_email: false,
        alert_admin_after_sends: null,
        config: {},
        updated_by: null,
        updated_at: now(),
      }),
      steps: [
        step(
          POLICY_IDS.postponement_events,
          1,
          0,
          'days',
          ['doula'],
          TEMPLATE_IDS.postponement_doula
        ),
      ],
    },
  ];

  for (const item of policies) {
    store.policies.set(item.policy.id, item.policy);
    store.steps.set(item.policy.id, item.steps);
  }
}
