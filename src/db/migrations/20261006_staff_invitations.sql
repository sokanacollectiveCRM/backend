-- Pending admin and doula invitations. Acceptance creates the staff account.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'doula')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  invited_by_email text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_one_pending
  ON public.staff_invitations (tenant_id, lower(email))
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.staff_invitation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.staff_invitations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event text NOT NULL CHECK (event IN ('invited', 'accepted')),
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invitations TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invitation_events TO app_user;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['staff_invitations', 'staff_invitation_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_stamp_tenant_id ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER a_stamp_tenant_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_id()',
      table_name
    );
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
