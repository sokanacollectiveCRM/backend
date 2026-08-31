-- Additive Cloud SQL schema for Sokana's native contract-signing workflow.
-- This intentionally leaves legacy/SignNow rows unconstrained unless
-- signing_provider is explicitly set to 'native'.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.phi_contracts
  ADD COLUMN IF NOT EXISTS signing_provider TEXT,
  ADD COLUMN IF NOT EXISTS template_identifier TEXT,
  ADD COLUMN IF NOT EXISTS template_version INTEGER,
  ADD COLUMN IF NOT EXISTS field_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS unsigned_document_path TEXT,
  ADD COLUMN IF NOT EXISTS unsigned_document_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS unsigned_document_generation BIGINT,
  ADD COLUMN IF NOT EXISTS signed_document_path TEXT,
  ADD COLUMN IF NOT EXISTS signed_document_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS signed_document_generation BIGINT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_signing_provider_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_signing_provider_check
      CHECK (signing_provider IS NULL OR signing_provider IN ('native', 'signnow'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_native_status_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_native_status_check
      CHECK (
        signing_provider IS DISTINCT FROM 'native'
        OR (
          status IS NOT NULL
          AND status IN (
            'draft', 'ready', 'sent', 'viewed', 'partially_signed',
            'signed', 'declined', 'expired', 'voided'
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_template_version_positive_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_template_version_positive_check
      CHECK (template_version IS NULL OR template_version > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_document_generations_positive_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_document_generations_positive_check
      CHECK (
        (unsigned_document_generation IS NULL OR unsigned_document_generation > 0)
        AND (signed_document_generation IS NULL OR signed_document_generation > 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_document_hashes_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_document_hashes_check
      CHECK (
        (unsigned_document_hash IS NULL OR unsigned_document_hash ~ '^[0-9a-fA-F]{64}$')
        AND (signed_document_hash IS NULL OR signed_document_hash ~ '^[0-9a-fA-F]{64}$')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_document_paths_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_document_paths_check
      CHECK (
        (
          unsigned_document_path IS NULL
          OR (
            NULLIF(btrim(unsigned_document_path), '') IS NOT NULL
            AND octet_length(unsigned_document_path) <= 2048
          )
        )
        AND (
          signed_document_path IS NULL
          OR (
            NULLIF(btrim(signed_document_path), '') IS NOT NULL
            AND octet_length(signed_document_path) <= 2048
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_field_snapshot_object_check'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_field_snapshot_object_check
      CHECK (field_snapshot IS NULL OR jsonb_typeof(field_snapshot) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_native_contract_client_key'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_native_contract_client_key UNIQUE (id, client_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.contract_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  version INTEGER NOT NULL,
  gcs_object_path TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  field_manifest JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contract_template_versions_identifier_version_key
    UNIQUE (identifier, version),
  CONSTRAINT contract_template_versions_version_positive_check
    CHECK (version > 0),
  CONSTRAINT contract_template_versions_content_hash_check
    CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT contract_template_versions_gcs_object_path_check
    CHECK (
      NULLIF(btrim(gcs_object_path), '') IS NOT NULL
      AND octet_length(gcs_object_path) <= 2048
    ),
  CONSTRAINT contract_template_versions_field_manifest_array_check
    CHECK (jsonb_typeof(field_manifest) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_template_versions_one_active_idx
  ON public.contract_template_versions (identifier)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS contract_template_versions_effective_at_idx
  ON public.contract_template_versions (effective_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.phi_contracts'::regclass
      AND conname = 'phi_contracts_template_version_fkey'
  ) THEN
    ALTER TABLE public.phi_contracts
      ADD CONSTRAINT phi_contracts_template_version_fkey
      FOREIGN KEY (template_identifier, template_version)
      REFERENCES public.contract_template_versions (identifier, version);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.signing_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  client_id UUID NOT NULL,
  token_hash BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  resend_count INTEGER NOT NULL DEFAULT 0,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signing_invitations_contract_client_fkey
    FOREIGN KEY (contract_id, client_id)
    REFERENCES public.phi_contracts (id, client_id) ON DELETE CASCADE,
  CONSTRAINT signing_invitations_client_fkey
    FOREIGN KEY (client_id)
    REFERENCES public.phi_clients (id) ON DELETE RESTRICT,
  CONSTRAINT signing_invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT signing_invitations_token_hash_length_check
    CHECK (octet_length(token_hash) = 32),
  CONSTRAINT signing_invitations_resend_count_check CHECK (resend_count >= 0),
  CONSTRAINT signing_invitations_progress_object_check
    CHECK (jsonb_typeof(progress) = 'object'),
  CONSTRAINT signing_invitations_completion_order_check
    CHECK (completed_at IS NULL OR opened_at IS NULL OR completed_at >= opened_at)
);

CREATE INDEX IF NOT EXISTS signing_invitations_contract_idx
  ON public.signing_invitations (contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS signing_invitations_client_idx
  ON public.signing_invitations (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS signing_invitations_expiry_idx
  ON public.signing_invitations (expires_at)
  WHERE revoked_at IS NULL AND completed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  client_id UUID NOT NULL,
  signature_type TEXT NOT NULL,
  typed_representation TEXT,
  private_object_path TEXT,
  adopted_initials TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  completed_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contract_signatures_contract_client_fkey
    FOREIGN KEY (contract_id, client_id)
    REFERENCES public.phi_contracts (id, client_id) ON DELETE RESTRICT,
  CONSTRAINT contract_signatures_client_fkey
    FOREIGN KEY (client_id)
    REFERENCES public.phi_clients (id) ON DELETE RESTRICT,
  CONSTRAINT contract_signatures_contract_client_key UNIQUE (contract_id, client_id),
  CONSTRAINT contract_signatures_type_check
    CHECK (signature_type IN ('typed', 'drawn')),
  CONSTRAINT contract_signatures_representation_check
    CHECK (
      (signature_type = 'typed'
        AND NULLIF(btrim(typed_representation), '') IS NOT NULL
        AND private_object_path IS NULL)
      OR
      (signature_type = 'drawn'
        AND NULLIF(btrim(private_object_path), '') IS NOT NULL
        AND typed_representation IS NULL)
    ),
  CONSTRAINT contract_signatures_initials_check
    CHECK (
      NULLIF(btrim(adopted_initials), '') IS NOT NULL
      AND char_length(adopted_initials) <= 16
      AND octet_length(adopted_initials) <= 64
    ),
  CONSTRAINT contract_signatures_consent_version_check
    CHECK (
      NULLIF(btrim(consent_version), '') IS NOT NULL
      AND octet_length(consent_version) <= 128
    ),
  CONSTRAINT contract_signatures_typed_representation_length_check
    CHECK (
      typed_representation IS NULL
      OR octet_length(typed_representation) <= 512
    ),
  CONSTRAINT contract_signatures_private_object_path_length_check
    CHECK (
      private_object_path IS NULL
      OR octet_length(private_object_path) <= 2048
    ),
  CONSTRAINT contract_signatures_completed_fields_check
    CHECK (
      jsonb_typeof(completed_field_ids) = 'array'
      AND jsonb_array_length(completed_field_ids) <= 500
      AND octet_length(completed_field_ids::text) <= 65536
    )
);

CREATE INDEX IF NOT EXISTS contract_signatures_client_idx
  ON public.contract_signatures (client_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'contract_event_type'
  ) THEN
    CREATE TYPE public.contract_event_type AS ENUM (
      'contract_created',
      'contract_sent',
      'contract_opened',
      'consent_accepted',
      'initials_adopted',
      'signature_adopted',
      'contract_signed',
      'signed_copy_sent',
      'contract_downloaded',
      'contract_expired',
      'contract_voided',
      'document_generated',
      'invitation_resent',
      'contract_declined',
      'delivery_failed',
      'document_archived'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.contract_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contract_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.phi_clients (id) ON DELETE RESTRICT,
  event_type public.contract_event_type NOT NULL,
  actor_type TEXT NOT NULL,
  actor_client_id UUID REFERENCES public.phi_clients (id) ON DELETE RESTRICT,
  actor_user_id TEXT,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  correlation_id TEXT NOT NULL,
  ip_address INET,
  user_agent VARCHAR(512),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT contract_events_contract_client_fkey
    FOREIGN KEY (contract_id, client_id)
    REFERENCES public.phi_contracts (id, client_id) ON DELETE RESTRICT,
  CONSTRAINT contract_events_actor_type_check
    CHECK (actor_type IN ('client', 'user', 'system', 'worker', 'provider')),
  CONSTRAINT contract_events_actor_identity_check
    CHECK (
      (actor_type = 'client'
        AND actor_client_id = client_id
        AND actor_user_id IS NULL)
      OR (actor_type = 'user' AND actor_user_id IS NOT NULL AND actor_client_id IS NULL)
      OR (actor_type IN ('system', 'worker', 'provider')
          AND actor_client_id IS NULL AND actor_user_id IS NULL)
    ),
  CONSTRAINT contract_events_actor_user_id_length_check
    CHECK (
      actor_user_id IS NULL
      OR (
        NULLIF(btrim(actor_user_id), '') IS NOT NULL
        AND octet_length(actor_user_id) <= 255
      )
    ),
  CONSTRAINT contract_events_correlation_id_length_check
    CHECK (
      NULLIF(btrim(correlation_id), '') IS NOT NULL
      AND octet_length(correlation_id) <= 255
    ),
  CONSTRAINT contract_events_metadata_object_check
    CHECK (
      jsonb_typeof(metadata) = 'object'
      AND octet_length(metadata::text) <= 65536
    )
);

CREATE INDEX IF NOT EXISTS contract_events_contract_time_idx
  ON public.contract_events (contract_id, server_timestamp, id);
CREATE INDEX IF NOT EXISTS contract_events_client_time_idx
  ON public.contract_events (client_id, server_timestamp DESC);
CREATE INDEX IF NOT EXISTS contract_events_correlation_idx
  ON public.contract_events (correlation_id);

CREATE TABLE IF NOT EXISTS public.contract_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  lease_owner TEXT,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contract_outbox_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT contract_outbox_idempotency_key_length_check
    CHECK (
      NULLIF(btrim(idempotency_key), '') IS NOT NULL
      AND octet_length(idempotency_key) <= 255
    ),
  CONSTRAINT contract_outbox_kind_check
    CHECK (kind IN (
      'signed_copy_email',
      'billing_notification',
      'portal_eligibility',
      'quickbooks_deposit_invoice',
      'client_portal_notification',
      'generate_unsigned_document',
      'send_signing_invitation',
      'send_signing_reminder',
      'generate_signed_document',
      'archive_signed_document'
    )),
  CONSTRAINT contract_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  CONSTRAINT contract_outbox_attempts_check CHECK (attempts >= 0),
  CONSTRAINT contract_outbox_payload_object_check
    CHECK (
      jsonb_typeof(payload) = 'object'
      AND octet_length(payload::text) <= 1048576
    ),
  CONSTRAINT contract_outbox_lease_check
    CHECK (
      (status = 'processing'
        AND leased_at IS NOT NULL
        AND lease_expires_at IS NOT NULL
        AND NULLIF(btrim(lease_owner), '') IS NOT NULL)
      OR
      (status <> 'processing')
    )
);

CREATE INDEX IF NOT EXISTS contract_outbox_claim_idx
  ON public.contract_outbox (available_at, created_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS contract_outbox_lease_expiry_idx
  ON public.contract_outbox (lease_expires_at)
  WHERE status = 'processing';

CREATE TABLE IF NOT EXISTS public.signing_rate_limits (
  bucket_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_started_at),
  CONSTRAINT signing_rate_limits_window_seconds_check CHECK (window_seconds > 0),
  CONSTRAINT signing_rate_limits_hit_count_check CHECK (hit_count >= 0),
  CONSTRAINT signing_rate_limits_expiry_check
    CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS signing_rate_limits_expiry_idx
  ON public.signing_rate_limits (expires_at);

CREATE OR REPLACE FUNCTION public.enforce_native_contract_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_is_sent BOOLEAN;
BEGIN
  NEW.updated_at := clock_timestamp();

  IF TG_OP = 'INSERT' THEN
    IF NEW.signing_provider = 'native'
      AND NEW.status <> 'draft' THEN
      RAISE EXCEPTION
        'A new native contract must start as draft';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.signing_provider IS DISTINCT FROM 'native' THEN
    IF NEW.signing_provider = 'native'
      AND NEW.status <> 'draft' THEN
      RAISE EXCEPTION
        'A contract entering the native workflow must start as draft';
    END IF;
    RETURN NEW;
  END IF;

  old_is_sent := OLD.sent_at IS NOT NULL
    OR OLD.status IN (
      'sent', 'viewed', 'partially_signed', 'signed',
      'declined', 'expired', 'voided'
    );

  IF old_is_sent AND (
    NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.signing_provider IS DISTINCT FROM OLD.signing_provider
    OR NEW.template_identifier IS DISTINCT FROM OLD.template_identifier
    OR NEW.template_version IS DISTINCT FROM OLD.template_version
    OR NEW.field_snapshot IS DISTINCT FROM OLD.field_snapshot
    OR NEW.unsigned_document_path IS DISTINCT FROM OLD.unsigned_document_path
    OR NEW.unsigned_document_hash IS DISTINCT FROM OLD.unsigned_document_hash
    OR NEW.unsigned_document_generation IS DISTINCT FROM OLD.unsigned_document_generation
  ) THEN
    RAISE EXCEPTION 'Native contract source fields are frozen after the contract is sent';
  END IF;

  IF NEW.signing_provider IS DISTINCT FROM 'native' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft' AND NEW.status IN ('ready', 'voided'))
      OR (OLD.status = 'ready' AND NEW.status IN ('draft', 'sent', 'voided'))
      OR (OLD.status = 'sent' AND NEW.status IN (
        'viewed', 'partially_signed', 'signed', 'declined', 'expired', 'voided'
      ))
      OR (OLD.status = 'viewed' AND NEW.status IN (
        'partially_signed', 'signed', 'declined', 'expired', 'voided'
      ))
      OR (OLD.status = 'partially_signed' AND NEW.status IN (
        'signed', 'declined', 'expired', 'voided'
      ))
    ) THEN
      RAISE EXCEPTION 'Invalid native contract status transition: % -> %',
        OLD.status, NEW.status;
    END IF;

    CASE NEW.status
      WHEN 'sent' THEN NEW.sent_at := COALESCE(NEW.sent_at, clock_timestamp());
      WHEN 'viewed' THEN NEW.viewed_at := COALESCE(NEW.viewed_at, clock_timestamp());
      WHEN 'signed' THEN NEW.signed_at := COALESCE(NEW.signed_at, clock_timestamp());
      WHEN 'declined' THEN NEW.declined_at := COALESCE(NEW.declined_at, clock_timestamp());
      WHEN 'expired' THEN NEW.expired_at := COALESCE(NEW.expired_at, clock_timestamp());
      WHEN 'voided' THEN NEW.voided_at := COALESCE(NEW.voided_at, clock_timestamp());
      ELSE NULL;
    END CASE;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS phi_contracts_native_lifecycle_trigger
  ON public.phi_contracts;
CREATE TRIGGER phi_contracts_native_lifecycle_trigger
BEFORE INSERT OR UPDATE ON public.phi_contracts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_native_contract_lifecycle();

CREATE OR REPLACE FUNCTION public.reject_contract_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'contract_events is append-only; % is not permitted', TG_OP;
END
$$;

DROP TRIGGER IF EXISTS contract_events_reject_update_delete_trigger
  ON public.contract_events;
CREATE TRIGGER contract_events_reject_update_delete_trigger
BEFORE UPDATE OR DELETE ON public.contract_events
FOR EACH ROW
EXECUTE FUNCTION public.reject_contract_audit_mutation();

COMMIT;
