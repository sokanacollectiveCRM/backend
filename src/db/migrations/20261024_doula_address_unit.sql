-- P-19: additive only; existing addresses/countries remain untouched.
BEGIN;
ALTER TABLE public.doulas ADD COLUMN IF NOT EXISTS unit_number varchar(100) DEFAULT NULL;
ALTER TABLE public.doulas ALTER COLUMN country SET DEFAULT 'United States';
COMMIT;
