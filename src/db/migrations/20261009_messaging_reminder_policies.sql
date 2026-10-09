-- Sokana360 admin-configurable messaging / reminder policies (v4).
-- Safe to run more than once. Does not add a postponed contract status.

ALTER TABLE public.phi_contracts
  ADD COLUMN IF NOT EXISTS reminders_stopped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminders_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminders_stopped_reason text;

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'dashboard', 'both')),
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  version integer NOT NULL DEFAULT 1,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.reminder_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  trigger_event text NOT NULL,
  anchor_field text NOT NULL,
  stop_conditions jsonb NOT NULL DEFAULT '{"rules":[]}'::jsonb,
  end_action text CHECK (end_action IS NULL OR end_action IN ('void_contract', 'admin_alert', 'stop')),
  end_action_delay_value integer,
  end_action_delay_unit text CHECK (
    end_action_delay_unit IS NULL
    OR end_action_delay_unit IN ('minutes', 'hours', 'days', 'business_days')
  ),
  end_action_template_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  notify_admin_email boolean NOT NULL DEFAULT false,
  alert_admin_after_sends integer,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.reminder_policy_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.reminder_policies(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  delay_value integer NOT NULL,
  delay_unit text NOT NULL CHECK (delay_unit IN ('minutes', 'hours', 'days', 'business_days')),
  repeat_every_value integer,
  repeat_every_unit text CHECK (
    repeat_every_unit IS NULL
    OR repeat_every_unit IN ('minutes', 'hours', 'days', 'business_days')
  ),
  channel text NOT NULL CHECK (channel IN ('email', 'dashboard', 'both')),
  recipient_roles text[] NOT NULL,
  template_id uuid NOT NULL REFERENCES public.message_templates(id),
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (policy_id, step_order)
);

CREATE TABLE IF NOT EXISTS public.reminder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.reminder_policies(id),
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  client_id uuid REFERENCES public.phi_clients(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.phi_contracts(id) ON DELETE SET NULL,
  doula_id uuid,
  status text NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'canceled', 'stopped_by_admin')),
  anchor_at timestamptz NOT NULL,
  current_step integer NOT NULL DEFAULT 1,
  next_due_at timestamptz,
  end_action_due_at timestamptz,
  sends_count integer NOT NULL DEFAULT 0,
  pause_reason text,
  completed_reason text,
  admin_alerted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_runs_active_subject_idx
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
  recipient_role text,
  recipient_email text,
  channel text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed', 'suppressed', 'test', 'pending')),
  suppress_reason text,
  error_class text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.client_postponements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.phi_contracts(id) ON DELETE SET NULL,
  reason_code text NOT NULL CHECK (
    reason_code IN ('waiting_paycheck', 'waiting_insurance_medicaid', 'other')
  ),
  reason_note text,
  requested_by text,
  approved_by text,
  starts_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restart_at timestamptz NOT NULL,
  max_days integer NOT NULL DEFAULT 14,
  status text NOT NULL CHECK (
    status IN ('requested', 'active', 'restarted', 'lifted', 'extended', 'canceled')
  )
);

CREATE TABLE IF NOT EXISTS public.client_postponement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postponement_id uuid NOT NULL REFERENCES public.client_postponements(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  client_id uuid,
  contract_id uuid,
  run_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by text,
  acknowledged_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  reminders_enabled boolean NOT NULL DEFAULT true,
  test_recipient_override_email text,
  contact_email text NOT NULL DEFAULT 'hello@sokanacollective.com',
  admin_notification_email text NOT NULL DEFAULT 'hello@sokanacollective.com',
  billing_notification_email text NOT NULL DEFAULT 'billing@sokanacollective.com',
  evaluation_link text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.messaging_settings (
  id, reminders_enabled, contact_email, admin_notification_email,
  billing_notification_email, evaluation_link
) VALUES (
  true, true, 'hello@sokanacollective.com', 'hello@sokanacollective.com',
  'billing@sokanacollective.com', 'https://forms.gle/sokana-evaluation-placeholder'
)
ON CONFLICT (id) DO NOTHING;

-- Removed deposit reminder policy (Oct 9 decision).
DELETE FROM public.reminder_policy_steps
WHERE policy_id IN (SELECT id FROM public.reminder_policies WHERE key = 'deposit_payment');
DELETE FROM public.reminder_policies WHERE key = 'deposit_payment';
DELETE FROM public.message_templates WHERE key LIKE 'deposit_payment%';

INSERT INTO public.message_templates (id, key, name, channel, subject, body_text, version)
VALUES
  ('a1111111-1111-4111-8111-111111111101', 'contract_sent_initial', 'Contract sent (sign-by date)', 'email',
   'Please sign your Sokana agreement by {{cancel_date}}',
   $t$Hello {{client_first_name}},

Please sign by {{cancel_date}} to reserve your doula; if it isn't signed by then we can't guarantee your doula's availability.

Sign here: {{signing_link}}

Sokana Collective$t$, 1),
  ('a1111111-1111-4111-8111-111111111102', 'contract_signing_reminder_day3', 'Day 3 signing reminder', 'email',
   'A reminder to sign your Sokana agreement',
   $t$Hello {{client_first_name}},

We see you haven't signed yet; do you have any questions?

We can hold your doula until {{cancel_date}}; if it isn't signed and your deposit paid by then, we'll need to release your doula.

Sign here: {{signing_link}}

Sokana Collective$t$, 1),
  ('a1111111-1111-4111-8111-111111111103', 'contract_signing_doula_nudge', 'Day 3 doula nudge', 'email',
   '{{client_first_name}} has not signed yet',
   '{{client_first_name}} hasn''t signed yet; feel free to check in.', 1),
  ('a1111111-1111-4111-8111-111111111104', 'contract_canceled_unsigned', 'Unsigned contract canceled', 'email',
   'Your Sokana agreement has been canceled',
   $t$Hello {{client_first_name}},

Your agreement has been canceled. If you still want services or have any questions, please reach out to {{contact_email}}.

Sokana Collective$t$, 1),
  ('a1111111-1111-4111-8111-111111111105', 'birth_outcomes_doula', 'Birth outcomes reminder', 'email',
   'Birth outcomes needed before payout',
   $t$Hello {{doula_name}},

Please complete birth outcomes and notes for {{client_first_name}}. Payout can't be submitted until outcomes and notes are complete.

{{crm_link}}$t$, 1),
  ('a1111111-1111-4111-8111-111111111106', 'overdue_notes_doula', 'Overdue notes (doula)', 'email',
   'Client notes are overdue',
   $t$Hello {{doula_name}},

It has been {{days_since_last_note}} days since the last note for {{client_first_name}}. An admin has been notified.

{{crm_link}}$t$, 1),
  ('a1111111-1111-4111-8111-111111111107', 'overdue_notes_admin', 'Overdue notes (admin)', 'email',
   'Overdue notes: {{client_first_name}}',
   'Notes for {{client_first_name}} are overdue ({{days_since_last_note}} days). {{crm_link}}', 1),
  ('a1111111-1111-4111-8111-111111111108', 'service_completed_evaluation', 'Service completed evaluation', 'email',
   'Please share feedback on your Sokana care',
   'Hello {{client_first_name}},' || E'\n\n' || 'We would love your feedback: {{evaluation_link}}', 1),
  ('a1111111-1111-4111-8111-111111111109', 'evaluation_received_admin', 'Evaluation received', 'email',
   'A client evaluation was received',
   'An evaluation was submitted. Open the CRM to review (no answers are included in this email). {{crm_link}}', 1),
  ('a1111111-1111-4111-8111-111111111110', 'postpartum_hours_low', 'Postpartum hours running low', 'email',
   'Your remaining postpartum hours are running low',
   'Hello {{client_first_name}},' || E'\n\n' || 'You have about {{hours_remaining}} of {{hours_contracted}} contracted postpartum hours remaining. Reach out to {{contact_email}} with questions.', 1),
  ('a1111111-1111-4111-8111-111111111111', 'card_not_on_file_billing', 'Card not on file', 'email',
   'Deposit paid but no card on file',
   'A client deposit was recorded but no stored card was detected. {{crm_link}}', 1),
  ('a1111111-1111-4111-8111-111111111112', 'doula_interview_logged_admin', 'Doula interview logged', 'email',
   'Interview note logged for {{client_first_name}}',
   'A doula logged an interview note for {{client_first_name}}. {{crm_link}}', 1),
  ('a1111111-1111-4111-8111-111111111113', 'admin_note_added_doula', 'Admin added a note', 'email',
   'New admin note for {{client_first_name}}',
   'An admin added a note for {{client_first_name}}. {{crm_link}}', 1),
  ('a1111111-1111-4111-8111-111111111114', 'headshot_updated_admin', 'Headshot updated', 'email',
   'A doula headshot needs review',
   'A doula updated their headshot and it is ready for approval. {{crm_link}}', 1),
  ('a1111111-1111-4111-8111-111111111115', 'postponement_doula', 'Postponement notice', 'email',
   'Reminders postponed for {{client_first_name}}',
   'Reminders for {{client_first_name}} are paused until {{restart_date}} ({{postponement_reason}}). They will restart automatically.', 1),
  ('a1111111-1111-4111-8111-111111111116', 'routine_update_dashboard', 'Routine update', 'dashboard',
   'Routine update',
   'A routine client update is available in the dashboard. {{crm_link}}', 1)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.reminder_policies (
  id, key, name, description, enabled, trigger_event, anchor_field, stop_conditions,
  end_action, end_action_delay_value, end_action_delay_unit, end_action_template_keys,
  notify_admin_email, alert_admin_after_sends, config
) VALUES
  ('b2222222-2222-4222-8222-222222222201', 'contract_signing', 'Contract signing',
   'Day 3 client reminder + doula nudge; day 7 cancel if unsigned. A signed contract is never auto-canceled.',
   true, 'contract_sent', 'sent_at',
   '{"rules":[{"type":"signed_and_deposit_paid"},{"type":"contract_status_in","statuses":["declined","voided","expired"]},{"type":"reminders_stopped"}]}'::jsonb,
   'void_contract', 7, 'days', '["contract_canceled_unsigned"]'::jsonb,
   false, null, '{"reset_anchor_on_resend":false}'::jsonb),
  ('b2222222-2222-4222-8222-222222222202', 'birth_outcomes', 'Birth outcomes',
   'Remind the doula at estimated due date + 5 days until outcomes are logged.',
   true, 'due_date_elapsed', 'due_date',
   '{"rules":[{"type":"birth_outcomes_recorded"}]}'::jsonb,
   'admin_alert', null, null, '[]'::jsonb,
   false, 3, '{"days_after_due_date":5}'::jsonb),
  ('b2222222-2222-4222-8222-222222222203', 'overdue_notes', 'Overdue notes',
   'Notify doula and admin when notes are stale.',
   true, 'notes_overdue_scan', 'last_note_at',
   '{"rules":[{"type":"note_created"}]}'::jsonb,
   'stop', null, null, '[]'::jsonb,
   true, null, '{"overdue_days":7}'::jsonb),
  ('b2222222-2222-4222-8222-222222222204', 'service_completed_evaluation', 'Service completed evaluation',
   'Send evaluation link when a client is marked complete.',
   false, 'client_completed', 'completed_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, false, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222205', 'evaluation_received', 'Evaluation received',
   'Notify admins when an evaluation is submitted (no answers).',
   false, 'evaluation_received', 'received_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, true, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222206', 'postpartum_hours_low', 'Postpartum hours low',
   'Email the client when remaining postpartum hours are low.',
   false, 'hours_logged', 'hours_logged_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, false, null,
   '{"remaining_hours_threshold":4,"remaining_pct":20}'::jsonb),
  ('b2222222-2222-4222-8222-222222222207', 'card_not_on_file', 'Card not on file',
   'Alert billing when a deposit is paid but no stored card exists.',
   false, 'deposit_paid_no_card', 'deposit_paid_at',
   '{"rules":[{"type":"card_on_file"}]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, false, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222208', 'doula_interview_logged', 'Doula interview logged',
   'Email admin when a doula logs an interview note.',
   false, 'interview_logged', 'logged_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, true, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222209', 'admin_note_added', 'Admin note added',
   'Email the assigned doula when an admin adds a note.',
   true, 'admin_note_added', 'note_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, false, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222210', 'headshot_updated', 'Headshot updated',
   'Notify admin to approve a new doula headshot.',
   true, 'headshot_updated', 'updated_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, true, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222211', 'routine_updates', 'Routine updates',
   'Dashboard-only notice for routine client updates.',
   true, 'routine_update', 'updated_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, false, null, '{}'::jsonb),
  ('b2222222-2222-4222-8222-222222222212', 'postponement_events', 'Postponement events',
   'Notify the doula when reminders are postponed.',
   true, 'postponement_changed', 'starts_at', '{"rules":[]}'::jsonb,
   'stop', 0, 'days', '[]'::jsonb, false, null, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.reminder_policy_steps (
  policy_id, step_order, delay_value, delay_unit, repeat_every_value, repeat_every_unit,
  channel, recipient_roles, template_id, enabled
)
SELECT v.policy_id, v.step_order, v.delay_value, v.delay_unit, v.repeat_every_value,
       v.repeat_every_unit, v.channel, v.recipient_roles, v.template_id, true
FROM (
  VALUES
    ('b2222222-2222-4222-8222-222222222201'::uuid, 1, 3, 'days', NULL, NULL, 'email', ARRAY['client']::text[], 'a1111111-1111-4111-8111-111111111102'::uuid),
    ('b2222222-2222-4222-8222-222222222201'::uuid, 2, 3, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'a1111111-1111-4111-8111-111111111103'::uuid),
    ('b2222222-2222-4222-8222-222222222202'::uuid, 1, 0, 'days', 48, 'hours', 'both', ARRAY['doula']::text[], 'a1111111-1111-4111-8111-111111111105'::uuid),
    ('b2222222-2222-4222-8222-222222222203'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'a1111111-1111-4111-8111-111111111106'::uuid),
    ('b2222222-2222-4222-8222-222222222203'::uuid, 2, 0, 'days', NULL, NULL, 'email', ARRAY['admin']::text[], 'a1111111-1111-4111-8111-111111111107'::uuid),
    ('b2222222-2222-4222-8222-222222222204'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['client']::text[], 'a1111111-1111-4111-8111-111111111108'::uuid),
    ('b2222222-2222-4222-8222-222222222205'::uuid, 1, 0, 'days', NULL, NULL, 'both', ARRAY['admin']::text[], 'a1111111-1111-4111-8111-111111111109'::uuid),
    ('b2222222-2222-4222-8222-222222222206'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['client']::text[], 'a1111111-1111-4111-8111-111111111110'::uuid),
    ('b2222222-2222-4222-8222-222222222207'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['billing']::text[], 'a1111111-1111-4111-8111-111111111111'::uuid),
    ('b2222222-2222-4222-8222-222222222208'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['admin']::text[], 'a1111111-1111-4111-8111-111111111112'::uuid),
    ('b2222222-2222-4222-8222-222222222209'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'a1111111-1111-4111-8111-111111111113'::uuid),
    ('b2222222-2222-4222-8222-222222222210'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['admin']::text[], 'a1111111-1111-4111-8111-111111111114'::uuid),
    ('b2222222-2222-4222-8222-222222222211'::uuid, 1, 0, 'days', NULL, NULL, 'dashboard', ARRAY['admin']::text[], 'a1111111-1111-4111-8111-111111111116'::uuid),
    ('b2222222-2222-4222-8222-222222222212'::uuid, 1, 0, 'days', NULL, NULL, 'email', ARRAY['doula']::text[], 'a1111111-1111-4111-8111-111111111115'::uuid)
) AS v(policy_id, step_order, delay_value, delay_unit, repeat_every_value, repeat_every_unit, channel, recipient_roles, template_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reminder_policy_steps s
  WHERE s.policy_id = v.policy_id AND s.step_order = v.step_order
);

COMMENT ON TABLE public.reminder_policies IS 'Admin-configurable reminder policies; timings and copy are editable via the messaging API.';
COMMENT ON COLUMN public.phi_contracts.reminders_stopped IS 'Per-contract stop switch for reminder runs. Does not change contract status.';
