-- Tenancy foundation.
-- Run as the table owner (Cloud SQL user `postgres`), not `app_user`.
-- Safe to run more than once. Does not turn isolation on by itself.
-- Existing rows are assigned to Sokana Collective. While TENANCY_ENFORCE is
-- off, new rows without a session tenant are stamped to Sokana Collective.
-- Set TENANCY_ENFORCE=on only after jobs, webhooks, and public signing set a
-- tenant. Organization admins are not inserted into platform_admins.

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  timezone text NOT NULL DEFAULT 'America/Denver',
  currency text NOT NULL DEFAULT 'USD',
  billing_anchor_day integer,
  cutoff_day integer,
  invoice_due_day integer,
  rule_version integer NOT NULL DEFAULT 1,
  staff_email_domain text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  principal_type text NOT NULL CHECK (principal_type IN ('admin', 'billing', 'doula', 'client')),
  principal_id uuid NOT NULL,
  linked_user_id text,
  identity_platform_uid text,
  email text,
  role text NOT NULL CHECK (role IN ('admin', 'billing', 'doula', 'client')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_principal_unique UNIQUE (tenant_id, principal_type, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_email ON public.memberships (lower(email));
CREATE INDEX IF NOT EXISTS idx_memberships_identity_uid
  ON public.memberships (identity_platform_uid)
  WHERE identity_platform_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_linked_user
  ON public.memberships (linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  identity_platform_uid text PRIMARY KEY,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tenants (id, slug, name, status)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'sokana-collective',
    'Sokana Collective',
    'active'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'synthetic-tenant-b',
    'Synthetic Tenant B',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, timezone, currency, rule_version)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'America/Denver', 'USD', 1),
  ('22222222-2222-4222-8222-222222222222', 'America/Denver', 'USD', 1)
ON CONFLICT (tenant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.stamp_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_tenant text;
  enforce text;
  sokana constant uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  session_tenant := NULLIF(current_setting('app.tenant_id', true), '');
  enforce := current_setting('app.tenancy_enforce', true);

  IF NEW.tenant_id IS NULL THEN
    IF session_tenant IS NOT NULL THEN
      NEW.tenant_id := session_tenant::uuid;
    ELSIF enforce IS DISTINCT FROM 'on' THEN
      NEW.tenant_id := sokana;
    END IF;
  END IF;

  IF enforce = 'on' THEN
    IF session_tenant IS NULL
      OR NEW.tenant_id IS NULL
      OR NEW.tenant_id::text <> session_tenant THEN
      RAISE EXCEPTION 'tenant write denied'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_cross_tenant_care_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  client_tenant uuid;
  doula_tenant uuid;
BEGIN
  IF current_setting('app.tenancy_enforce', true) IS DISTINCT FROM 'on' THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO client_tenant
  FROM public.phi_clients
  WHERE id = NEW.client_id;

  SELECT tenant_id INTO doula_tenant
  FROM public.doulas
  WHERE id = NEW.doula_id;

  IF client_tenant IS DISTINCT FROM NEW.tenant_id
    OR doula_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'cross-tenant care link denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tenant_tables text[] := ARRAY[
    'admins',
    'billing_reminder_email_audit',
    'client_activities',
    'client_documents',
    'client_onboarding_events',
    'client_onboarding_readiness',
    'client_payment_methods',
    'contract_events',
    'contract_outbox',
    'contract_signatures',
    'customers',
    'doula_assignments',
    'doula_availability',
    'doula_booking_requests',
    'doula_documents',
    'doulas',
    'expenses',
    'hours',
    'payment_installments',
    'payment_schedules',
    'payments',
    'phi_access_audit',
    'phi_clients',
    'phi_contracts',
    'phi_events',
    'phi_invoices',
    'phi_notes',
    'phi_time_track',
    'quickbooks_tokens',
    'signing_access_sessions',
    'signing_invitations'
  ];
  table_name text;
  sokana uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)',
      table_name
    );
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL',
      table_name
    ) USING sokana;
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
      'idx_' || table_name || '_tenant_id',
      table_name
    );

    EXECUTE format('DROP TRIGGER IF EXISTS a_stamp_tenant_id ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER a_stamp_tenant_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_id()',
      table_name
    );

    IF table_name IN ('hours', 'doula_assignments') THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS b_reject_cross_tenant_care_link ON public.%I',
        table_name
      );
      EXECUTE format(
        'CREATE TRIGGER b_reject_cross_tenant_care_link BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_cross_tenant_care_link()',
        table_name
      );
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', table_name);
    EXECUTE format(
      $policy$
        CREATE POLICY tenant_isolation ON public.%I
          AS PERMISSIVE
          FOR ALL
          USING (
            current_setting('app.tenancy_enforce', true) IS DISTINCT FROM 'on'
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
          )
          WITH CHECK (
            current_setting('app.tenancy_enforce', true) IS DISTINCT FROM 'on'
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
          )
      $policy$,
      table_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.admins') IS NOT NULL THEN
    INSERT INTO public.memberships (
      tenant_id, principal_type, principal_id, linked_user_id,
      identity_platform_uid, email, role, status
    )
    SELECT
      '11111111-1111-4111-8111-111111111111',
      'admin',
      a.id,
      NULL,
      a.identity_platform_uid,
      lower(a.email),
      'admin',
      'active'
    FROM public.admins a
    ON CONFLICT (tenant_id, principal_type, principal_id) DO NOTHING;
  END IF;

  IF to_regclass('public.doulas') IS NOT NULL THEN
    INSERT INTO public.memberships (
      tenant_id, principal_type, principal_id, linked_user_id,
      identity_platform_uid, email, role, status
    )
    SELECT
      '11111111-1111-4111-8111-111111111111',
      'doula',
      d.id,
      NULL,
      d.identity_platform_uid,
      lower(d.email),
      'doula',
      CASE
        WHEN lower(coalesce(d.account_status, '')) IN (
          'inactive', 'disabled', 'terminated', 'suspended', 'rejected', 'archived', 'deleted'
        ) THEN 'inactive'
        ELSE 'active'
      END
    FROM public.doulas d
    ON CONFLICT (tenant_id, principal_type, principal_id) DO NOTHING;
  END IF;

  IF to_regclass('public.phi_clients') IS NOT NULL THEN
    INSERT INTO public.memberships (
      tenant_id, principal_type, principal_id, linked_user_id,
      identity_platform_uid, email, role, status
    )
    SELECT
      '11111111-1111-4111-8111-111111111111',
      'client',
      c.id,
      c.user_id,
      c.identity_platform_uid,
      lower(c.email),
      'client',
      CASE
        WHEN lower(coalesce(c.portal_status, '')) IN (
          'inactive', 'disabled', 'terminated', 'suspended', 'rejected', 'archived', 'deleted'
        ) THEN 'inactive'
        ELSE 'active'
      END
    FROM public.phi_clients c
    ON CONFLICT (tenant_id, principal_type, principal_id) DO NOTHING;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.tenants, public.tenant_settings, public.memberships, public.platform_admins
  TO app_user;
