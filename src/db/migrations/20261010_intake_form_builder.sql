-- Per-organization intake form drafts, published versions, and logo assets.
-- Run as the table owner (Cloud SQL user `postgres`), not `app_user`.
-- Safe to run more than once. Does not publish a form.
-- Sokana's first draft is created from the standard template the first time
-- an admin opens the editor. Until version 1 is published, public submit
-- keeps the legacy normalizer.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS published_intake_form_version integer;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS intake_form_version integer,
  ADD COLUMN IF NOT EXISTS custom_answers jsonb,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.phi_clients.custom_answers IS
  'Answers to custom intake questions. Standard questions stay on their own columns.';
COMMENT ON COLUMN public.phi_clients.is_test IS
  'Admin test submissions. Excluded from staff email, matching, and dashboard counts.';
COMMENT ON COLUMN public.phi_clients.intake_form_version IS
  'Published intake form version this lead was submitted against. Null for the legacy form and for tests of an unpublished draft.';

CREATE TABLE IF NOT EXISTS public.intake_form_drafts (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  definition jsonb NOT NULL,
  base_version integer,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intake_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  version integer NOT NULL,
  definition jsonb NOT NULL,
  published_by text,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intake_form_versions_tenant_version UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_intake_form_versions_tenant
  ON public.intake_form_versions (tenant_id, version DESC);

CREATE TABLE IF NOT EXISTS public.intake_form_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  object_path text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_form_assets_tenant
  ON public.intake_form_assets (tenant_id);

CREATE TABLE IF NOT EXISTS public.intake_form_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_form_audit_tenant
  ON public.intake_form_audit_events (tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.intake_form_drafts,
     public.intake_form_versions,
     public.intake_form_assets,
     public.intake_form_audit_events
  TO app_user;
