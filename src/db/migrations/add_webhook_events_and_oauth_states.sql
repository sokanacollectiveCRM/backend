-- PR 5: provider webhook idempotency ledger + single-use OAuth state store.
-- Additive only. Apply manually (never at app boot).

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  event_key text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_key_uniq UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx
  ON public.webhook_events (received_at);

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'quickbooks',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS oauth_states_provider_expires_at_idx
  ON public.oauth_states (provider, expires_at);
