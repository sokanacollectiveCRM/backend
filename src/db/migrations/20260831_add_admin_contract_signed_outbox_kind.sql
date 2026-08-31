-- Allow admin contract-signed notification outbox jobs.
BEGIN;

ALTER TABLE public.contract_outbox
  DROP CONSTRAINT IF EXISTS contract_outbox_kind_check;

ALTER TABLE public.contract_outbox
  ADD CONSTRAINT contract_outbox_kind_check
  CHECK (kind IN (
    'signed_copy_email',
    'admin_contract_signed_notification',
    'billing_notification',
    'portal_eligibility',
    'quickbooks_deposit_invoice',
    'client_portal_notification',
    'generate_unsigned_document',
    'send_signing_invitation',
    'send_signing_reminder',
    'generate_signed_document',
    'archive_signed_document'
  ));

COMMIT;
