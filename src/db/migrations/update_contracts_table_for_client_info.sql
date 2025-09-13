-- Update contracts table to properly integrate with client_info system
-- This migration ensures contracts are properly associated with clients in the system

-- First, let's ensure we have the contract_templates table
CREATE TABLE IF NOT EXISTS contract_templates (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  fee TEXT,
  deposit TEXT
);

-- Update the contracts table to match the schema view structure
-- This will replace the SignNow-focused structure with a client_info-focused one
CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Link to client_info (the main client/user in your system)
  client_id UUID REFERENCES client_info(id) ON DELETE CASCADE,

  -- Contract template information
  template_id BIGINT REFERENCES contract_templates(id),
  template_name TEXT,

  -- Contract content and pricing
  fee TEXT,
  deposit TEXT,
  note TEXT,

  -- Document management
  document_url TEXT, -- URL to the signed contract document

  -- Contract status tracking
  status TEXT DEFAULT 'draft', -- draft, pending_signature, signed, active, completed, cancelled

  -- User who generated the contract
  generated_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_generated_by ON contracts(generated_by);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);

-- Create a separate table for SignNow integration if needed
CREATE TABLE IF NOT EXISTS contract_signnow_integration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  signnow_document_id VARCHAR(255) UNIQUE,
  signnow_envelope_id VARCHAR(255),
  signing_url TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, viewed, signed, completed, declined
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for SignNow integration
CREATE INDEX IF NOT EXISTS idx_contract_signnow_contract_id ON contract_signnow_integration(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signnow_document_id ON contract_signnow_integration(signnow_document_id);
CREATE INDEX IF NOT EXISTS idx_contract_signnow_status ON contract_signnow_integration(status);

-- Create contract payments table (separate from the main contracts table)
CREATE TABLE IF NOT EXISTS contract_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL, -- deposit, installment, final
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, canceled, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for contract payments
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract_id ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_stripe_intent_id ON contract_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_status ON contract_payments(status);
CREATE INDEX IF NOT EXISTS idx_contract_payments_type ON contract_payments(payment_type);

-- Add comments for documentation
COMMENT ON TABLE contracts IS 'Main contracts table linked to client_info for proper client association';
COMMENT ON COLUMN contracts.client_id IS 'References client_info.id - the main client/user in the system';
COMMENT ON COLUMN contracts.template_id IS 'References contract_templates.id for contract structure';
COMMENT ON COLUMN contracts.generated_by IS 'References users.id - who created/generated this contract';
COMMENT ON TABLE contract_signnow_integration IS 'Handles SignNow document signing integration separately from main contract data';
COMMENT ON TABLE contract_payments IS 'Tracks payment history for contracts (deposits, installments, final payments)';
