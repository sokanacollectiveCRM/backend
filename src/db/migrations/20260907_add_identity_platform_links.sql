-- Explicit Identity Platform-to-Cloud SQL principal links.
-- No authentication accounts are created and no emails are sent by this migration.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS identity_platform_uid text;

ALTER TABLE public.doulas
  ADD COLUMN IF NOT EXISTS identity_platform_uid text;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS identity_platform_uid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_identity_platform_uid
  ON public.admins (identity_platform_uid)
  WHERE identity_platform_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_doulas_identity_platform_uid
  ON public.doulas (identity_platform_uid)
  WHERE identity_platform_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phi_clients_identity_platform_uid
  ON public.phi_clients (identity_platform_uid)
  WHERE identity_platform_uid IS NOT NULL;

COMMENT ON COLUMN public.admins.identity_platform_uid IS
  'GCP Identity Platform UID; application role remains authoritative in Cloud SQL.';
COMMENT ON COLUMN public.doulas.identity_platform_uid IS
  'GCP Identity Platform UID; application role remains authoritative in Cloud SQL.';
COMMENT ON COLUMN public.phi_clients.identity_platform_uid IS
  'GCP Identity Platform UID used to resolve the owning portal principal.';
