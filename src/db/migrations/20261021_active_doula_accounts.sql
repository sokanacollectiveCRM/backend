-- Profile review is independent of operational account access.
-- Preserve explicitly disabled/suspended accounts.
BEGIN;
ALTER TABLE public.doulas ALTER COLUMN account_status SET DEFAULT 'active';
UPDATE public.doulas SET account_status='active', updated_at=now()
WHERE account_status IN ('pending', 'approved');
COMMIT;
