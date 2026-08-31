-- Reversible teardown for 20260829_add_native_contract_signing.sql.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.contract_events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS contract_events_reject_update_delete_trigger
      ON public.contract_events;
  END IF;
END
$$;
DROP FUNCTION IF EXISTS public.reject_contract_audit_mutation();

DROP TRIGGER IF EXISTS phi_contracts_native_lifecycle_trigger
  ON public.phi_contracts;
DROP FUNCTION IF EXISTS public.enforce_native_contract_lifecycle();

DROP TABLE IF EXISTS public.signing_rate_limits;
DROP TABLE IF EXISTS public.contract_outbox;
DROP TABLE IF EXISTS public.contract_events;
DROP TYPE IF EXISTS public.contract_event_type;
DROP TABLE IF EXISTS public.contract_signatures;
DROP TABLE IF EXISTS public.signing_invitations;

ALTER TABLE public.phi_contracts
  DROP CONSTRAINT IF EXISTS phi_contracts_template_version_fkey;
DROP TABLE IF EXISTS public.contract_template_versions;

ALTER TABLE public.phi_contracts
  DROP CONSTRAINT IF EXISTS phi_contracts_native_contract_client_key,
  DROP CONSTRAINT IF EXISTS phi_contracts_field_snapshot_object_check,
  DROP CONSTRAINT IF EXISTS phi_contracts_document_paths_check,
  DROP CONSTRAINT IF EXISTS phi_contracts_document_hashes_check,
  DROP CONSTRAINT IF EXISTS phi_contracts_document_generations_positive_check,
  DROP CONSTRAINT IF EXISTS phi_contracts_template_version_positive_check,
  DROP CONSTRAINT IF EXISTS phi_contracts_native_status_check,
  DROP CONSTRAINT IF EXISTS phi_contracts_signing_provider_check,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS voided_at,
  DROP COLUMN IF EXISTS expired_at,
  DROP COLUMN IF EXISTS declined_at,
  DROP COLUMN IF EXISTS signed_at,
  DROP COLUMN IF EXISTS consented_at,
  DROP COLUMN IF EXISTS viewed_at,
  DROP COLUMN IF EXISTS sent_at,
  DROP COLUMN IF EXISTS signed_document_generation,
  DROP COLUMN IF EXISTS signed_document_hash,
  DROP COLUMN IF EXISTS signed_document_path,
  DROP COLUMN IF EXISTS unsigned_document_generation,
  DROP COLUMN IF EXISTS unsigned_document_hash,
  DROP COLUMN IF EXISTS unsigned_document_path,
  DROP COLUMN IF EXISTS field_snapshot,
  DROP COLUMN IF EXISTS template_version,
  DROP COLUMN IF EXISTS template_identifier,
  DROP COLUMN IF EXISTS signing_provider;

COMMIT;
