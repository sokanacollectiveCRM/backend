BEGIN;
-- HR profiles reuse staff identity records, but never authenticate as admins.
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS staff_role text NOT NULL DEFAULT 'admin' CHECK(staff_role IN ('admin','hr'));
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_role_check CHECK(role IN ('admin','billing','doula','client','hr'));
COMMIT;
