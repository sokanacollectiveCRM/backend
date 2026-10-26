BEGIN;
-- Profiles and uploads remain organization-owned. One login may have profiles
-- in several organizations; uniqueness must not be platform-wide.
DO $$ DECLARE tab text; c record; BEGIN
 FOREACH tab IN ARRAY ARRAY['admins','doulas'] LOOP
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid=('public.'||tab)::regclass AND contype='u'
    AND array_length(conkey,1)=1 AND conkey[1] IN
      (SELECT attnum FROM pg_attribute WHERE attrelid=('public.'||tab)::regclass AND attname IN ('email','identity_platform_uid'))
  LOOP EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',tab,c.conname); END LOOP;
 END LOOP;
END $$;
DROP INDEX IF EXISTS public.idx_admins_identity_platform_uid;
DROP INDEX IF EXISTS public.idx_doulas_identity_platform_uid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_tenant_email_unique ON public.admins(tenant_id,lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_doulas_tenant_email_unique ON public.doulas(tenant_id,lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_tenant_identity_unique ON public.admins(tenant_id,identity_platform_uid) WHERE identity_platform_uid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doulas_tenant_identity_unique ON public.doulas(tenant_id,identity_platform_uid) WHERE identity_platform_uid IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.staff_membership_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 principal_id uuid NOT NULL, event text NOT NULL CHECK(event IN ('removed','joined','reinstated')),
 actor_id text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.staff_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 email text NOT NULL,first_name text NOT NULL,last_name text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','doula','hr')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 token_hash text NOT NULL,expires_at timestamptz NOT NULL,invited_by_email text,
 accepted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_invitations ADD COLUMN IF NOT EXISTS invited_by_id text;
ALTER TABLE public.staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_role_check;
ALTER TABLE public.staff_invitations ADD CONSTRAINT staff_invitations_role_check CHECK(role IN ('admin','doula','hr'));
CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_one_pending ON public.staff_invitations(tenant_id,lower(email)) WHERE status='pending';
CREATE TABLE IF NOT EXISTS public.staff_invitation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invitation_id uuid NOT NULL REFERENCES public.staff_invitations(id),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),event text NOT NULL CHECK(event IN ('invited','accepted')),actor_email text,created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_user') THEN
 GRANT SELECT,INSERT ON public.staff_membership_events TO app_user;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.staff_invitations,public.staff_invitation_events TO app_user;
END IF; END $$;
COMMIT;
