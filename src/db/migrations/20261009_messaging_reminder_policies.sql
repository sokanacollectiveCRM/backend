-- Sokana360 admin-configurable messaging / reminder policies (v4).
-- Safe to run more than once. Does not add `postponed` to contract status.
-- No deposit_payment policy. Signing is native (this repo), not a third-party e-sign vendor.

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'dashboard', 'both')),
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.reminder_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  trigger_event text NOT NULL,
  anchor_field text NOT NULL,
  stop_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  end_action text NOT NULL DEFAULT 'stop'
    CHECK (end_action IN ('void_contract', 'admin_alert', 'stop')),
  end_action_delay_value integer,
  end_action_delay_unit text
    CHECK (end_action_delay_unit IS NULL OR end_action_delay_unit IN ('minutes', 'hours', 'days', 'business_days')),
  end_action_template_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  notify_admin_email boolean NOT NULL DEFAULT false,
  alert_admin_after_sends integer,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.reminder_policy_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.reminder_policies(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  delay_value integer NOT NULL DEFAULT 0,
  delay_unit text NOT NULL
    CHECK (delay_unit IN ('minutes', 'hours', 'days', 'business_days')),
  repeat_every_value integer,
  repeat_every_unit text
    CHECK (repeat_every_unit IS NULL OR repeat_every_unit IN ('minutes', 'hours', 'days', 'business_days')),
  channel text NOT NULL CHECK (channel IN ('email', 'dashboard', 'both')),
  recipient_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  template_id uuid NOT NULL REFERENCES public.message_templates(id),
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (policy_id, step_order)
);

CREATE TABLE IF NOT EXISTS public.reminder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.reminder_policies(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  client_id uuid REFERENCES public.phi_clients(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.phi_contracts(id) ON DELETE SET NULL,
  doula_id uuid,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'canceled', 'stopped_by_admin')),
  anchor_at timestamptz NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  next_due_at timestamptz,
  end_action_due_at timestamptz,
  sends_count integer NOT NULL DEFAULT 0,
  pause_reason text,
  completed_reason text,
  claimed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_runs_one_open_per_subject
  ON public.reminder_runs (policy_id, subject_type, subject_id)
  WHERE status IN ('active', 'paused');

CREATE INDEX IF NOT EXISTS reminder_runs_due_idx
  ON public.reminder_runs (status, next_due_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.reminder_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.reminder_runs(id) ON DELETE SET NULL,
  policy_key text NOT NULL,
  step_order integer,
  template_key text,
  template_version integer,
  idempotency_key text NOT NULL UNIQUE,
  recipient_role text CHECK (recipient_role IS NULL OR recipient_role IN ('client', 'doula', 'admin', 'billing')),
  recipient_email text,
  channel text NOT NULL CHECK (channel IN ('email', 'dashboard', 'both')),
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed', 'suppressed', 'test')),
  suppress_reason text,
  error_class text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reminder_send_log_run_idx
  ON public.reminder_send_log (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_postponements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.phi_contracts(id) ON DELETE SET NULL,
  reason_code text NOT NULL
    CHECK (reason_code IN ('waiting_paycheck', 'waiting_insurance_medicaid', 'other')),
  reason_note text,
  requested_by uuid,
  approved_by uuid,
  starts_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restart_at timestamptz NOT NULL,
  max_days integer NOT NULL DEFAULT 14,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'active', 'restarted', 'lifted', 'extended', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS client_postponements_client_idx
  ON public.client_postponements (client_id, status);

CREATE TABLE IF NOT EXISTS public.client_postponement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postponement_id uuid NOT NULL REFERENCES public.client_postponements(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  client_id uuid REFERENCES public.phi_clients(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.phi_contracts(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.reminder_runs(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by uuid,
  acknowledged_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_alerts_open_idx
  ON public.admin_alerts (created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  reminders_enabled boolean NOT NULL DEFAULT true,
  test_recipient_override_email text,
  contact_email text NOT NULL DEFAULT 'hello@sokanacollective.com',
  admin_notification_email text NOT NULL DEFAULT 'hello@sokanacollective.com',
  billing_notification_email text NOT NULL DEFAULT 'billing@sokanacollective.com',
  evaluation_link text,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.messaging_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.contract_reminder_overrides (
  contract_id uuid PRIMARY KEY REFERENCES public.phi_contracts(id) ON DELETE CASCADE,
  stopped boolean NOT NULL DEFAULT false,
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Remove a deposit reminder policy if a prior draft migration seeded one.
DELETE FROM public.reminder_policy_steps
WHERE policy_id IN (SELECT id FROM public.reminder_policies WHERE key = 'deposit_payment');
DELETE FROM public.reminder_policies WHERE key = 'deposit_payment';
DELETE FROM public.message_templates WHERE key LIKE 'deposit_payment%';

-- ---------------------------------------------------------------------------
-- Templates (insert if missing; do not clobber admin edits)
-- ---------------------------------------------------------------------------
INSERT INTO public.message_templates (id, key, name, channel, subject, body_text, body_html, version)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'contract_sent_initial',
    'Contract sent (sign-by date)',
    'email',
    'Please review and sign by {{cancel_date}}: your Sokana agreement',
    E'Hello {{client_first_name}},\n\nPlease review and sign your agreement using this secure link:\n{{signing_link}}\n\nPlease sign by {{cancel_date}} to reserve your doula; if it isn''t signed by then we can''t guarantee your doula''s availability.\n\nIf you have any questions, reach out to {{contact_email}}.\n\nSokana Collective',
    '<p>Hello {{client_first_name}},</p><p>Please review and sign your agreement using this secure link:</p><p><a href="{{signing_link}}">Review and sign contract</a></p><p>Please sign by <strong>{{cancel_date}}</strong> to reserve your doula; if it isn''t signed by then we can''t guarantee your doula''s availability.</p><p>If you have any questions, reach out to {{contact_email}}.</p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'contract_signing_reminder_day3',
    'Contract signing reminder (day 3)',
    'email',
    'Checking in about your Sokana agreement',
    E'Hello {{client_first_name}},\n\nWe see you haven''t signed yet; do you have any questions?\n\nWe can hold your doula until {{cancel_date}}; if it isn''t signed and your deposit paid by then, we''ll need to release your doula.\n\nSign here: {{signing_link}}\n\nYou can reach us at {{contact_email}}.\n\nSokana Collective',
    '<p>Hello {{client_first_name}},</p><p>We see you haven''t signed yet; do you have any questions?</p><p>We can hold your doula until <strong>{{cancel_date}}</strong>; if it isn''t signed and your deposit paid by then, we''ll need to release your doula.</p><p><a href="{{signing_link}}">Review and sign contract</a></p><p>You can reach us at {{contact_email}}.</p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'contract_signing_doula_nudge',
    'Unsigned contract — doula nudge',
    'email',
    '{{client_first_name}} hasn''t signed yet',
    E'Hi {{doula_name}},\n\n{{client_first_name}} hasn''t signed yet; feel free to check in.\n\nThe agreement can be held until {{cancel_date}}.\n\nSokana Collective',
    '<p>Hi {{doula_name}},</p><p>{{client_first_name}} hasn''t signed yet; feel free to check in.</p><p>The agreement can be held until {{cancel_date}}.</p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'contract_canceled_unsigned',
    'Unsigned contract canceled',
    'email',
    'Your Sokana agreement has been canceled',
    E'Hello {{client_first_name}},\n\nYour agreement has been canceled. If you still want services or have any questions, please reach out to {{contact_email}}.\n\nSokana Collective',
    '<p>Hello {{client_first_name}},</p><p>Your agreement has been canceled. If you still want services or have any questions, please reach out to {{contact_email}}.</p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    'birth_outcomes_reminder',
    'Birth outcomes reminder',
    'both',
    'Birth outcomes needed before payout',
    E'Hi {{doula_name}},\n\nPlease complete birth outcomes and notes for {{client_first_name}}. Payout can''t be submitted until outcomes and notes are complete.\n\nOpen in CRM: {{crm_link}}\n\nSokana Collective',
    '<p>Hi {{doula_name}},</p><p>Please complete birth outcomes and notes for {{client_first_name}}. Payout can''t be submitted until outcomes and notes are complete.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'overdue_notes_doula',
    'Overdue notes — doula',
    'email',
    'Please add a note for {{client_first_name}}',
    E'Hi {{doula_name}},\n\nIt has been {{days_since_last_note}} days since the last note for {{client_first_name}}. Please add a note in the CRM. The admin team has also been notified.\n\n{{crm_link}}\n\nSokana Collective',
    '<p>Hi {{doula_name}},</p><p>It has been {{days_since_last_note}} days since the last note for {{client_first_name}}. Please add a note in the CRM. The admin team has also been notified.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    'overdue_notes_admin',
    'Overdue notes — admin',
    'email',
    'Overdue notes: {{client_first_name}}',
    E'A note is overdue for {{client_first_name}} ({{days_since_last_note}} days). Doula: {{doula_name}}.\n\n{{crm_link}}\n\nSokana Collective',
    '<p>A note is overdue for {{client_first_name}} ({{days_since_last_note}} days). Doula: {{doula_name}}.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    'service_completed_evaluation',
    'Service complete — evaluation',
    'email',
    'How was your Sokana experience?',
    E'Hello {{client_first_name}},\n\nThank you for trusting Sokana. Please take a moment to share feedback:\n{{evaluation_link}}\n\nSokana Collective',
    '<p>Hello {{client_first_name}},</p><p>Thank you for trusting Sokana. Please take a moment to share feedback:</p><p><a href="{{evaluation_link}}">Evaluation form</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000009',
    'evaluation_received_admin',
    'Evaluation received',
    'both',
    'A client evaluation was received',
    E'An evaluation was submitted for {{client_first_name}}. No answers or clinical details are included in this notice.\n\nOpen in CRM: {{crm_link}}\n\nSokana Collective',
    '<p>An evaluation was submitted for {{client_first_name}}. No answers or clinical details are included in this notice.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-00000000000a',
    'postpartum_hours_low',
    'Postpartum hours running low',
    'email',
    'Your postpartum hours are running low',
    E'Hello {{client_first_name}},\n\nYou have about {{hours_remaining}} hours remaining of {{hours_contracted}} contracted postpartum hours. Reach out to {{contact_email}} if you would like to discuss adding hours.\n\nSokana Collective',
    '<p>Hello {{client_first_name}},</p><p>You have about {{hours_remaining}} hours remaining of {{hours_contracted}} contracted postpartum hours. Reach out to {{contact_email}} if you would like to discuss adding hours.</p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-00000000000b',
    'card_not_on_file_billing',
    'Card not on file',
    'email',
    'Card not on file after deposit: {{client_first_name}}',
    E'A deposit was received for {{client_first_name}}, but no stored card was detected.\n\nOpen in CRM: {{crm_link}}\n\nSokana Collective',
    '<p>A deposit was received for {{client_first_name}}, but no stored card was detected.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-00000000000c',
    'doula_interview_logged_admin',
    'Doula interview logged',
    'email',
    'Interview logged for {{client_first_name}}',
    E'A doula logged an interview note for {{client_first_name}}. You may want to follow up with the family.\n\n{{crm_link}}\n\nSokana Collective',
    '<p>A doula logged an interview note for {{client_first_name}}. You may want to follow up with the family.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-00000000000d',
    'admin_note_added_doula',
    'Admin added a note',
    'email',
    'New admin note for {{client_first_name}}',
    E'Hi {{doula_name}},\n\nAn admin added a note for {{client_first_name}}. Please review it in the CRM.\n\n{{crm_link}}\n\nSokana Collective',
    '<p>Hi {{doula_name}},</p><p>An admin added a note for {{client_first_name}}. Please review it in the CRM.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-00000000000e',
    'headshot_updated_admin',
    'Headshot updated — approve',
    'email',
    'A doula updated their headshot',
    E'A doula updated their profile photo and it needs review.\n\n{{crm_link}}\n\nSokana Collective',
    '<p>A doula updated their profile photo and it needs review.</p><p><a href="{{crm_link}}">Open in CRM</a></p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-00000000000f',
    'postponement_paused_doula',
    'Reminders postponed',
    'email',
    'Reminders paused for {{client_first_name}}',
    E'Hi {{doula_name}},\n\nReminders for {{client_first_name}} are paused until {{restart_date}} ({{postponement_reason}}). They will restart automatically from the day-3 reminder.\n\nSokana Collective',
    '<p>Hi {{doula_name}},</p><p>Reminders for {{client_first_name}} are paused until {{restart_date}} ({{postponement_reason}}). They will restart automatically from the day-3 reminder.</p><p>Sokana Collective</p>',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000010',
    'routine_update_dashboard',
    'Routine update (dashboard only)',
    'dashboard',
    'Update',
    'A routine update is available in the CRM for {{client_first_name}}.',
    '<p>A routine update is available in the CRM for {{client_first_name}}.</p>',
    1
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
INSERT INTO public.reminder_policies (
  id, key, name, description, enabled, trigger_event, anchor_field,
  stop_conditions, end_action, end_action_delay_value, end_action_delay_unit,
  end_action_template_keys, notify_admin_email, alert_admin_after_sends, config
) VALUES
  (
    'b2000000-0000-4000-8000-000000000001',
    'contract_signing',
    'Contract signing',
    'Day-3 client reminder + doula nudge; day-7 cancel if still unsigned. Never voids a signed contract.',
    true,
    'contract_sent',
    'sent_at',
    '["signed_and_deposit_paid","declined","voided","expired","stopped_by_admin"]'::jsonb,
    'void_contract',
    7,
    'days',
    ARRAY['contract_canceled_unsigned']::text[],
    false,
    NULL,
    '{"reset_anchor_on_resend":false,"initial_via_event":true}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'birth_outcomes',
    'Birth outcomes',
    'Remind the assigned doula starting at estimated due date + 5 days, or sooner if baby is delivered. Skip if outcomes are already recorded.',
    true,
    'due_date_elapsed',
    'due_date',
    '["birth_outcomes_recorded"]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    3,
    '{"days_after_due_date":5}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'overdue_notes',
    'Overdue notes',
    'Notify the doula and admin when a client has no note for N days (seed 7).',
    true,
    'overdue_notes_scan',
    'last_note_at',
    '["note_created"]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{"overdue_days":7}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    'service_completed_evaluation',
    'Service completed — evaluation',
    'Send the evaluation link when a client is marked complete. Disabled until the completion workflow exists.',
    false,
    'client_completed',
    'completed_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000005',
    'evaluation_received',
    'Evaluation received',
    'Admin notice when an evaluation is submitted (no answers or clinical details). Disabled until the in-system form exists.',
    false,
    'evaluation_received',
    'received_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    true,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000006',
    'postpartum_hours_low',
    'Postpartum hours low',
    'Client email when remaining postpartum hours hit the threshold. Disabled until hours-vs-contract tracking exists.',
    false,
    'hours_threshold',
    'hours_logged_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{"remaining_hours_threshold":4,"remaining_pct":20}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000007',
    'card_not_on_file',
    'Card not on file',
    'Billing alert when a deposit is paid but no stored card is detected. Disabled until QuickBooks card detection is wired.',
    false,
    'deposit_paid_no_card',
    'deposit_paid_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000008',
    'doula_interview_logged',
    'Doula interview logged',
    'Admin email when a doula logs an interview note so Nancy can follow up. Disabled until enabled in the UI.',
    false,
    'doula_interview_logged',
    'logged_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    true,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-000000000009',
    'admin_note_added',
    'Admin added a note',
    'Email the assigned doula when an admin adds a client note.',
    true,
    'admin_note_added',
    'note_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-00000000000a',
    'headshot_updated',
    'Headshot updated',
    'Admin approve notice when a doula updates their headshot.',
    true,
    'headshot_updated',
    'updated_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    true,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-00000000000b',
    'routine_update',
    'Routine updates',
    'Dashboard-only notice for routine updates (no email).',
    true,
    'routine_update',
    'updated_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{}'::jsonb
  ),
  (
    'b2000000-0000-4000-8000-00000000000c',
    'postponement_notice',
    'Postponement notice',
    'Notify the assigned doula when reminders are postponed.',
    true,
    'postponement_event',
    'starts_at',
    '[]'::jsonb,
    'stop',
    NULL,
    NULL,
    ARRAY[]::text[],
    false,
    NULL,
    '{}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Steps: insert only when the policy currently has none (do not clobber admin edits).
INSERT INTO public.reminder_policy_steps (
  policy_id, step_order, delay_value, delay_unit, repeat_every_value, repeat_every_unit,
  channel, recipient_roles, template_id, enabled
)
SELECT p.id, v.step_order, v.delay_value, v.delay_unit, v.repeat_every_value, v.repeat_every_unit,
       v.channel, v.recipient_roles, t.id, v.enabled
FROM (
  VALUES
    ('contract_signing', 0, 0, 'days', NULL::integer, NULL::text, 'email', ARRAY['client']::text[], 'contract_sent_initial', true),
    ('contract_signing', 1, 3, 'days', NULL, NULL, 'email', ARRAY['client']::text[], 'contract_signing_reminder_day3', true),
    ('contract_signing', 2, 3, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'contract_signing_doula_nudge', true),
    ('birth_outcomes', 0, 0, 'days', 48, 'hours', 'both', ARRAY['doula']::text[], 'birth_outcomes_reminder', true),
    ('overdue_notes', 0, 0, 'days', 7, 'days', 'email', ARRAY['doula']::text[], 'overdue_notes_doula', true),
    ('overdue_notes', 1, 0, 'days', 7, 'days', 'email', ARRAY['admin']::text[], 'overdue_notes_admin', true),
    ('service_completed_evaluation', 0, 0, 'days', NULL, NULL, 'email', ARRAY['client']::text[], 'service_completed_evaluation', true),
    ('evaluation_received', 0, 0, 'days', NULL, NULL, 'both', ARRAY['admin']::text[], 'evaluation_received_admin', true),
    ('postpartum_hours_low', 0, 0, 'days', NULL, NULL, 'email', ARRAY['client']::text[], 'postpartum_hours_low', true),
    ('card_not_on_file', 0, 0, 'days', NULL, NULL, 'email', ARRAY['billing']::text[], 'card_not_on_file_billing', true),
    ('doula_interview_logged', 0, 0, 'days', NULL, NULL, 'email', ARRAY['admin']::text[], 'doula_interview_logged_admin', true),
    ('admin_note_added', 0, 0, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'admin_note_added_doula', true),
    ('headshot_updated', 0, 0, 'days', NULL, NULL, 'email', ARRAY['admin']::text[], 'headshot_updated_admin', true),
    ('routine_update', 0, 0, 'days', NULL, NULL, 'dashboard', ARRAY['admin']::text[], 'routine_update_dashboard', true),
    ('postponement_notice', 0, 0, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'postponement_paused_doula', true)
) AS v(policy_key, step_order, delay_value, delay_unit, repeat_every_value, repeat_every_unit, channel, recipient_roles, template_key, enabled)
JOIN public.reminder_policies p ON p.key = v.policy_key
JOIN public.message_templates t ON t.key = v.template_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.reminder_policy_steps s WHERE s.policy_id = p.id
);
