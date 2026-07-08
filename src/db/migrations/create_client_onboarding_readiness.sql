-- Portal onboarding readiness + audit events (Cloud SQL / sokana_private).
-- Stores computed eligibility and QuickBooks payment-authorization metadata only.
-- Never store raw card numbers, CVV, or expiration dates.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.client_onboarding_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  contract_signed BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  billing_path TEXT,
  payment_authorization_required BOOLEAN NOT NULL DEFAULT FALSE,
  payment_authorization_satisfied BOOLEAN NOT NULL DEFAULT FALSE,
  card_on_file BOOLEAN NOT NULL DEFAULT FALSE,
  qb_customer_id TEXT,
  qb_stored_payment_method_id TEXT,
  is_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  portal_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_portal_blocker TEXT,
  verification_invoice_id TEXT,
  verification_invoice_sent_at TIMESTAMPTZ,
  verification_invoice_paid_at TIMESTAMPTZ,
  eligibility_last_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_onboarding_readiness_client_id
  ON public.client_onboarding_readiness (client_id);

CREATE INDEX IF NOT EXISTS idx_client_onboarding_readiness_is_eligible
  ON public.client_onboarding_readiness (is_eligible);

CREATE INDEX IF NOT EXISTS idx_client_onboarding_readiness_verification_invoice_id
  ON public.client_onboarding_readiness (verification_invoice_id)
  WHERE verification_invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS trigger_client_onboarding_readiness_updated_at ON public.client_onboarding_readiness;
CREATE TRIGGER trigger_client_onboarding_readiness_updated_at
  BEFORE UPDATE ON public.client_onboarding_readiness
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.phi_clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_onboarding_events_client_id
  ON public.client_onboarding_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_onboarding_events_event_type
  ON public.client_onboarding_events (event_type);

COMMENT ON TABLE public.client_onboarding_readiness IS 'Backend source of truth for portal eligibility and payment authorization readiness.';
COMMENT ON TABLE public.client_onboarding_events IS 'Audit trail for onboarding and portal eligibility transitions.';
