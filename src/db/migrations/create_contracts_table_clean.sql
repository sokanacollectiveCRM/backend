-- Create contracts table from scratch with proper client_info integration
-- This script creates all necessary tables for the contract system

-- Step 1: Create contract_templates table
CREATE TABLE IF NOT EXISTS contract_templates (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  fee TEXT,
  deposit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create main contracts table
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
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),

  -- SignNow integration (optional)
  signnow_document_id VARCHAR(255) UNIQUE,

  -- Original contract data for reference (optional)
  original_contract_data JSONB
);

-- Step 3: Create SignNow integration table
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

-- Step 4: Create contract payments table
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

-- Step 5: Create indexes for better performance
-- Contracts table indexes
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_generated_by ON contracts(generated_by);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);
CREATE INDEX IF NOT EXISTS idx_contracts_signnow_document_id ON contracts(signnow_document_id);

-- SignNow integration indexes
CREATE INDEX IF NOT EXISTS idx_contract_signnow_contract_id ON contract_signnow_integration(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signnow_document_id ON contract_signnow_integration(signnow_document_id);
CREATE INDEX IF NOT EXISTS idx_contract_signnow_status ON contract_signnow_integration(status);

-- Contract payments indexes
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract_id ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_stripe_intent_id ON contract_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_status ON contract_payments(status);
CREATE INDEX IF NOT EXISTS idx_contract_payments_type ON contract_payments(payment_type);

-- Step 6: Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_signnow_integration_updated_at
  BEFORE UPDATE ON contract_signnow_integration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Add comments for documentation
COMMENT ON TABLE contracts IS 'Main contracts table linked to client_info for proper client association';
COMMENT ON COLUMN contracts.client_id IS 'References client_info.id - the main client/user in the system';
COMMENT ON COLUMN contracts.template_id IS 'References contract_templates.id for contract structure';
COMMENT ON COLUMN contracts.generated_by IS 'References users.id - who created/generated this contract';
COMMENT ON COLUMN contracts.status IS 'Contract status: draft, pending_signature, signed, active, completed, cancelled';
COMMENT ON COLUMN contracts.signnow_document_id IS 'Optional SignNow document ID for external signing integration';
COMMENT ON COLUMN contracts.original_contract_data IS 'Optional JSONB field for storing original contract data';

COMMENT ON TABLE contract_templates IS 'Contract templates for standardized contract generation';
COMMENT ON TABLE contract_signnow_integration IS 'Handles SignNow document signing integration separately from main contract data';
COMMENT ON TABLE contract_payments IS 'Tracks payment history for contracts (deposits, installments, final payments)';

-- Step 8: Insert some sample contract templates (optional)
INSERT INTO contract_templates (title, storage_path, fee, deposit) VALUES
('Standard Postpartum Doula Services', 'templates/postpartum-doula-standard.docx', '$2,500', '$500'),
('Extended Postpartum Support', 'templates/postpartum-doula-extended.docx', '$3,500', '$750'),
('Overnight Care Package', 'templates/overnight-care.docx', '$1,800', '$400')
ON CONFLICT DO NOTHING;

-- Step 9: Create a view for easy contract querying with client info
CREATE OR REPLACE VIEW contracts_with_clients AS
SELECT
  c.id,
  c.client_id,
  c.template_id,
  c.template_name,
  c.fee,
  c.deposit,
  c.note,
  c.document_url,
  c.status,
  c.generated_by,
  c.created_at,
  c.updated_at,
  c.signnow_document_id,
  -- Client information
  ci.first_name as client_first_name,
  ci.last_name as client_last_name,
  ci.email as client_email,
  ci.phone_number as client_phone,
  -- Generated by user information
  u.firstname as generated_by_firstname,
  u.lastname as generated_by_lastname,
  u.email as generated_by_email,
  -- Template information
  ct.title as template_title,
  ct.storage_path as template_storage_path
FROM contracts c
LEFT JOIN client_info ci ON c.client_id = ci.id
LEFT JOIN users u ON c.generated_by = u.id
LEFT JOIN contract_templates ct ON c.template_id = ct.id;

-- Step 10: Create a function to get contract statistics
CREATE OR REPLACE FUNCTION get_contract_stats()
RETURNS TABLE (
  total_contracts BIGINT,
  draft_contracts BIGINT,
  pending_signature_contracts BIGINT,
  signed_contracts BIGINT,
  active_contracts BIGINT,
  completed_contracts BIGINT,
  cancelled_contracts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_contracts,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_contracts,
    COUNT(*) FILTER (WHERE status = 'pending_signature') as pending_signature_contracts,
    COUNT(*) FILTER (WHERE status = 'signed') as signed_contracts,
    COUNT(*) FILTER (WHERE status = 'active') as active_contracts,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_contracts,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_contracts
  FROM contracts;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON contract_templates TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON contract_signnow_integration TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON contract_payments TO your_app_user;

-- Step 12: Final verification
SELECT
  'Contracts Table Created Successfully' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') as contracts_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'contract_templates' AND table_schema = 'public') as templates_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'contract_signnow_integration' AND table_schema = 'public') as signnow_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'contract_payments' AND table_schema = 'public') as payments_table_exists;
