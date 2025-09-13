-- Complete the contracts table setup based on existing structure
-- Your table already has client_id and generated_by - we just need to add a few missing pieces

-- Step 1: Add missing columns that don't exist yet
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS template_id BIGINT;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS template_name TEXT;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS fee TEXT;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS deposit TEXT;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS document_url TEXT;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS signnow_document_id VARCHAR(255) UNIQUE;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS original_contract_data JSONB;

-- Step 2: Create contract_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS contract_templates (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  fee TEXT,
  deposit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Add foreign key constraint for template_id (after creating contract_templates)
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contracts_template_id_fkey'
    AND table_name = 'contracts'
  ) THEN
    ALTER TABLE contracts
    ADD CONSTRAINT contracts_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES contract_templates(id);
  END IF;
END $$;

-- Step 4: Create SignNow integration table
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

-- Step 5: Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_contracts_signnow_document_id ON contracts(signnow_document_id);

-- Create indexes for SignNow integration
CREATE INDEX IF NOT EXISTS idx_contract_signnow_contract_id ON contract_signnow_integration(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signnow_document_id ON contract_signnow_integration(signnow_document_id);
CREATE INDEX IF NOT EXISTS idx_contract_signnow_status ON contract_signnow_integration(status);

-- Step 6: Update contract_payments table if it exists, or create it
DO $$
BEGIN
  -- Check if contract_payments table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_payments' AND table_schema = 'public') THEN
    -- Table exists, just ensure it has the right structure
    ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50);
    ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE contract_payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

    -- Update existing records to have payment_type
    UPDATE contract_payments
    SET payment_type = 'deposit'
    WHERE payment_type IS NULL;
  ELSE
    -- Create new contract_payments table
    CREATE TABLE contract_payments (
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
    CREATE INDEX idx_contract_payments_contract_id ON contract_payments(contract_id);
    CREATE INDEX idx_contract_payments_stripe_intent_id ON contract_payments(stripe_payment_intent_id);
    CREATE INDEX idx_contract_payments_status ON contract_payments(status);
    CREATE INDEX idx_contract_payments_type ON contract_payments(payment_type);
  END IF;
END $$;

-- Step 7: Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to contracts table
DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Insert sample contract templates
INSERT INTO contract_templates (title, storage_path, fee, deposit) VALUES
('Standard Postpartum Doula Services', 'templates/postpartum-doula-standard.docx', '$2,500', '$500'),
('Extended Postpartum Support', 'templates/postpartum-doula-extended.docx', '$3,500', '$750'),
('Overnight Care Package', 'templates/overnight-care.docx', '$1,800', '$400')
ON CONFLICT DO NOTHING;

-- Step 9: Create helpful views
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

-- Step 10: Create function to get contracts needing manual cleanup
CREATE OR REPLACE FUNCTION get_contracts_needing_cleanup()
RETURNS TABLE (
  contract_id UUID,
  needs_template_assignment BOOLEAN,
  needs_fee_deposit_info BOOLEAN,
  client_info TEXT,
  generated_by_info TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as contract_id,
    (c.template_id IS NULL) as needs_template_assignment,
    (c.fee IS NULL OR c.deposit IS NULL) as needs_fee_deposit_info,
    CONCAT(ci.first_name, ' ', ci.last_name, ' (', ci.email, ')') as client_info,
    CONCAT(u.firstname, ' ', u.lastname, ' (', u.email, ')') as generated_by_info
  FROM contracts c
  LEFT JOIN client_info ci ON c.client_id = ci.id
  LEFT JOIN users u ON c.generated_by = u.id
  WHERE c.template_id IS NULL OR c.fee IS NULL OR c.deposit IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Add comments for documentation
COMMENT ON TABLE contracts IS 'Main contracts table linked to client_info for proper client association';
COMMENT ON COLUMN contracts.client_id IS 'References client_info.id - the main client/user in the system';
COMMENT ON COLUMN contracts.template_id IS 'References contract_templates.id for contract structure';
COMMENT ON COLUMN contracts.generated_by IS 'References users.id - who created/generated this contract';
COMMENT ON COLUMN contracts.signnow_document_id IS 'SignNow document ID for external signing integration';

-- Step 12: Final verification and summary
SELECT
  'Contracts Table Setup Complete!' as status,
  (SELECT COUNT(*) FROM contracts) as total_contracts,
  (SELECT COUNT(*) FROM contracts WHERE client_id IS NOT NULL) as contracts_with_clients,
  (SELECT COUNT(*) FROM contracts WHERE generated_by IS NOT NULL) as contracts_with_users,
  (SELECT COUNT(*) FROM contracts WHERE template_id IS NOT NULL) as contracts_with_templates,
  (SELECT COUNT(*) FROM contracts WHERE signnow_document_id IS NOT NULL) as contracts_with_signnow_ids;

-- Show any contracts that need additional information
SELECT 'Contracts needing additional information:' as cleanup_status;
SELECT * FROM get_contracts_needing_cleanup();
