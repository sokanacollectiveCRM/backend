CREATE TABLE IF NOT EXISTS public.billing_reminder_email_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  sender_user_id uuid NULL,
  sender_role text NOT NULL,
  installment_number integer NULL,
  recipient_email text NOT NULL,
  template_key text NULL,
  payment_issue_type text NULL,
  subject text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_reminder_email_audit_contract_id_idx
  ON public.billing_reminder_email_audit (contract_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS billing_reminder_email_audit_recipient_idx
  ON public.billing_reminder_email_audit (recipient_email);
