-- Nullable for legacy accounts and invitations; required on profile saves.
BEGIN;
ALTER TABLE public.doulas ADD COLUMN IF NOT EXISTS phone text;
-- Preserve valid legacy numbers in the single canonical, digits-only format.
UPDATE public.doulas
SET phone = CASE
  WHEN phone ~ '^[0-9]{10}$' THEN phone
  WHEN phone ~ '^[0-9]{3}-[0-9]{3}-[0-9]{4}$' THEN replace(phone, '-', '')
  ELSE NULL
END
WHERE phone IS NOT NULL;
ALTER TABLE public.doulas DROP CONSTRAINT IF EXISTS doulas_phone_ten_digits;
ALTER TABLE public.doulas ADD CONSTRAINT doulas_phone_ten_digits
  CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$');
COMMIT;
