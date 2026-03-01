-- Add signnow_document_id to phi_contracts for SignNow contract signing integration
-- Run on Cloud SQL (sokana_private) if phi_contracts exists but lacks this column

ALTER TABLE public.phi_contracts
  ADD COLUMN IF NOT EXISTS signnow_document_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_phi_contracts_signnow_document_id
  ON public.phi_contracts (signnow_document_id) WHERE signnow_document_id IS NOT NULL;
