-- P-16: Add nullable expiration data to each structured certification.
-- Legacy year values and all other keys are retained. No expiration is explicit;
-- older entries remain unspecified until their owner supplies a date or choice.
BEGIN;
UPDATE public.doulas AS d
SET certifications = (
  SELECT jsonb_agg(
    jsonb_build_object('expiration_date', NULL, 'no_expiration', false) || entry
    ORDER BY ordinal
  )
  FROM jsonb_array_elements(d.certifications) WITH ORDINALITY AS cert(entry, ordinal)
)
WHERE jsonb_typeof(d.certifications) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(d.certifications) AS cert(entry)
    WHERE NOT (entry ? 'expiration_date') OR NOT (entry ? 'no_expiration')
  );
COMMENT ON COLUMN public.doulas.certifications IS
  'Certification name, issuingOrganization, nullable expiration_date (YYYY-MM-DD), and explicit no_expiration; historical year retained.';
COMMIT;
