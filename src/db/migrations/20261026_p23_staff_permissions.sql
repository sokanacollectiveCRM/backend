BEGIN;
ALTER TABLE public.doula_hr_permissions DROP CONSTRAINT IF EXISTS doula_hr_permissions_pkey;
ALTER TABLE public.doula_hr_permissions ADD PRIMARY KEY(tenant_id,admin_id,department);
CREATE TABLE IF NOT EXISTS public.staff_permission_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 actor_id text NOT NULL, admin_id text NOT NULL,
 capability text NOT NULL CHECK(capability IN ('hr','payroll')),
 old_value boolean NOT NULL, new_value boolean NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(old_value <> new_value)
);
CREATE INDEX IF NOT EXISTS staff_permission_events_latest ON public.staff_permission_events(tenant_id,changed_at DESC);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_user') THEN
  GRANT SELECT, INSERT, DELETE ON public.doula_hr_permissions TO app_user;
  GRANT SELECT, INSERT ON public.staff_permission_events TO app_user;
 END IF;
END $$;
COMMIT;
