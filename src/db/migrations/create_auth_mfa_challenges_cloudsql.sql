-- Short-lived email OTP challenges for Identity Platform staff login (app-level 2FA).
CREATE TABLE IF NOT EXISTS public.auth_mfa_challenges (
  id UUID PRIMARY KEY,
  auth_uid TEXT NOT NULL,
  email TEXT NOT NULL,
  id_token_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_mfa_challenges_auth_uid_idx
  ON public.auth_mfa_challenges (auth_uid);

CREATE INDEX IF NOT EXISTS auth_mfa_challenges_expires_at_idx
  ON public.auth_mfa_challenges (expires_at);
