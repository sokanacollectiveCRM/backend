-- Oct 21 doula document types.
-- Keeps retired values so existing W9, direct deposit, and background check
-- rows stay valid. Does not delete rows or files.
-- Idempotent: drop and recreate the document_type check.

ALTER TABLE public.doula_documents
  DROP CONSTRAINT IF EXISTS doula_documents_document_type_check;

ALTER TABLE public.doula_documents
  ADD CONSTRAINT doula_documents_document_type_check
  CHECK (document_type IN (
    'training_certificate',
    'liability_insurance_certificate',
    'illinois_medicaid_certification',
    'miscellaneous',
    'license',
    'other',
    'background_check',
    'w9',
    'direct_deposit_form'
  ));

COMMENT ON TABLE public.doula_documents IS
  'Doula document metadata. File bytes are in GCS. Required for activation: training_certificate approved. Optional: liability_insurance_certificate, illinois_medicaid_certification, miscellaneous, license, other. Retired (existing rows kept, new uploads rejected): background_check, w9, direct_deposit_form.';
