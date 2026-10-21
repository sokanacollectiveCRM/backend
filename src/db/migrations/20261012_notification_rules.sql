-- Sokana360 notification rules. Rules themselves stay in code and are not editable.
BEGIN;

ALTER TABLE public.phi_contracts
  ADD COLUMN IF NOT EXISTS signing_window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_window_phase TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS signing_reminders_disabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.phi_contracts
SET signing_window_started_at = sent_at
WHERE signing_window_started_at IS NULL
  AND sent_at IS NOT NULL;

ALTER TABLE public.phi_contracts
  DROP CONSTRAINT IF EXISTS phi_contracts_signing_window_phase_check;

ALTER TABLE public.phi_contracts
  ADD CONSTRAINT phi_contracts_signing_window_phase_check
  CHECK (signing_window_phase IN ('standard', 'resumed_at_day3'));

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS baby_delivered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.notification_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.notification_control (id, kill_switch)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  rule_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject_type TEXT,
  subject_id UUID,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_subject
  ON public.notification_deliveries (subject_type, subject_id);

CREATE TABLE IF NOT EXISTS public.dashboard_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  audience TEXT NOT NULL,
  doula_id UUID,
  client_id UUID,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  blocks_payout BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT dashboard_notices_audience_check CHECK (audience IN ('admin', 'doula')),
  CONSTRAINT dashboard_notices_severity_check CHECK (severity IN ('info', 'red'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notices_open
  ON public.dashboard_notices (audience, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.client_postponements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  note TEXT,
  restart_on DATE NOT NULL,
  status TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT client_postponements_reason_check
    CHECK (reason IN (
      'waiting_on_paycheck',
      'waiting_on_insurance_or_medicaid',
      'other'
    )),
  CONSTRAINT client_postponements_status_check
    CHECK (status IN (
      'requested',
      'active',
      'lifted',
      'extended',
      'canceled',
      'restarted'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_postponements_one_active
  ON public.client_postponements (client_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.postponement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postponement_id UUID NOT NULL REFERENCES public.client_postponements(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
