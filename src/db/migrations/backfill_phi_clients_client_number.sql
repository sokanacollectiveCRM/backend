-- Backfill client_number for existing phi_clients rows.
-- Idempotent:
-- - fills only missing/blank client_number values
-- - preserves any existing CL-##### values
-- - advances the sequence to the current maximum so future inserts stay unique

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.phi_clients_client_number_seq START 1;

WITH ordered_clients AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(requested_at, created_at, updated_at, now()), id
    ) AS rn
  FROM public.phi_clients
  WHERE client_number IS NULL OR btrim(client_number) = ''
),
existing_max AS (
  SELECT COALESCE(MAX(substring(client_number from '[0-9]+$')::bigint), 0) AS max_num
  FROM public.phi_clients
  WHERE client_number ~ '^CL-[0-9]+$'
),
updated_rows AS (
  UPDATE public.phi_clients pc
  SET client_number = 'CL-' || LPAD((em.max_num + oc.rn)::text, 5, '0')
  FROM ordered_clients oc
  CROSS JOIN existing_max em
  WHERE pc.id = oc.id
  RETURNING pc.id
)
SELECT COUNT(*) AS backfilled_client_numbers FROM updated_rows;

DO $$
DECLARE
  v_max_num bigint;
BEGIN
  SELECT COALESCE(MAX(substring(client_number from '[0-9]+$')::bigint), 0)
  INTO v_max_num
  FROM public.phi_clients
  WHERE client_number ~ '^CL-[0-9]+$';

  IF v_max_num > 0 THEN
    PERFORM setval('public.phi_clients_client_number_seq', v_max_num, true);
  ELSE
    PERFORM setval('public.phi_clients_client_number_seq', 1, false);
  END IF;
END $$;

COMMIT;
