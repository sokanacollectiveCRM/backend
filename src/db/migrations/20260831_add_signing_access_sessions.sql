-- Short-lived signing access sessions exchanged from invitation credentials.
-- Invitation secrets never appear in HTTP request paths after exchange.

CREATE TABLE IF NOT EXISTS public.signing_access_sessions (
  id UUID PRIMARY KEY,
  invitation_id UUID NOT NULL,
  token_hash BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT signing_access_sessions_invitation_fkey
    FOREIGN KEY (invitation_id)
    REFERENCES public.signing_invitations (id) ON DELETE CASCADE,
  CONSTRAINT signing_access_sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT signing_access_sessions_token_hash_length_check
    CHECK (octet_length(token_hash) = 32)
);

CREATE INDEX IF NOT EXISTS signing_access_sessions_invitation_idx
  ON public.signing_access_sessions (invitation_id);

CREATE INDEX IF NOT EXISTS signing_access_sessions_expiry_idx
  ON public.signing_access_sessions (expires_at)
  WHERE revoked_at IS NULL;
