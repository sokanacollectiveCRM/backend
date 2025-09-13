-- Update existing contracts table to integrate with client_info
-- This script modifies your existing table without losing data

-- Step 1: First, let's see what columns exist in your current contracts table
-- (This is just for reference - we'll add the missing columns)

-- Step 2: Add missing columns to existing contracts table
-- Add client_id column to link with client_info
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES client_info(id) ON DELETE CASCADE;

-- Add template_id column to link with contract templates
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS template_id BIGINT;

-- Add template_name column
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS template_name TEXT;

-- Add fee column (if not exists)
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS fee TEXT;

-- Add deposit column (if not exists)
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS deposit TEXT;

-- Add note column
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add document_url column
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add generated_by column to link with users
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES users(id);

-- Add original_contract_data column for data preservation
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS original_contract_data JSONB;

-- Step 3: Create contract_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS contract_templates (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  fee TEXT,
  deposit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Add foreign key constraint for template_id (after creating contract_templates)
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

-- Step 5: Migrate existing data to new columns
-- Try to link existing contracts to client_info by email
UPDATE contracts
SET client_id = (
  SELECT id FROM client_info
  WHERE client_info.email = contracts.client_email
)
WHERE client_id IS NULL AND client_email IS NOT NULL;

-- Set template_name for existing contracts
UPDATE contracts
SET template_name = 'Migrated Contract'
WHERE template_name IS NULL;

-- Migrate deposit_amount to fee and deposit columns
UPDATE contracts
SET fee = deposit_amount::text,
    deposit = deposit_amount::text
WHERE fee IS NULL AND deposit_amount IS NOT NULL;

-- Add note for migrated contracts
UPDATE contracts
SET note = 'Migrated from old system - needs client linking'
WHERE note IS NULL;

-- Store original contract data in JSONB field
UPDATE contracts
SET original_contract_data = jsonb_build_object(
  'client_email', client_email,
  'client_name', client_name,
  'contract_data', contract_data,
  'deposit_amount', deposit_amount,
  'total_amount', total_amount,
  'signed_at', signed_at,
  'payment_completed_at', payment_completed_at
)
WHERE original_contract_data IS NULL;

-- Step 6: Create new indexes for the added columns
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_contracts_generated_by ON contracts(generated_by);

-- Step 7: Create SignNow integration table
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

-- Step 8: Update contract_payments table if it exists, or create it
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

-- Step 9: Create triggers for automatic timestamp updates
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

-- Step 10: Add comments for documentation
COMMENT ON TABLE contracts IS 'Main contracts table linked to client_info for proper client association';
COMMENT ON COLUMN contracts.client_id IS 'References client_info.id - the main client/user in the system';
COMMENT ON COLUMN contracts.template_id IS 'References contract_templates.id for contract structure';
COMMENT ON COLUMN contracts.generated_by IS 'References users.id - who created/generated this contract';
COMMENT ON COLUMN contracts.signnow_document_id IS 'SignNow document ID for external signing integration';
COMMENT ON COLUMN contracts.original_contract_data IS 'Original contract data from old system for reference';

-- Step 11: Insert sample contract templates
INSERT INTO contract_templates (title, storage_path, fee, deposit) VALUES
('Standard Postpartum Doula Services', 'templates/postpartum-doula-standard.docx', '$2,500', '$500'),
('Extended Postpartum Support', 'templates/postpartum-doula-extended.docx', '$3,500', '$750'),
('Overnight Care Package', 'templates/overnight-care.docx', '$1,800', '$400')
ON CONFLICT DO NOTHING;

-- Step 12: Create helpful views
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

-- Step 13: Create function to get contracts needing manual cleanup
CREATE OR REPLACE FUNCTION get_contracts_needing_cleanup()
RETURNS TABLE (
  contract_id UUID,
  client_email TEXT,
  client_name TEXT,
  needs_client_linking BOOLEAN,
  needs_user_assignment BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as contract_id,
    c.client_email,
    c.client_name,
    (c.client_id IS NULL) as needs_client_linking,
    (c.generated_by IS NULL) as needs_user_assignment
  FROM contracts c
  WHERE c.client_id IS NULL OR c.generated_by IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Final verification and summary
SELECT
  'Contracts Table Updated Successfully' as status,
  (SELECT COUNT(*) FROM contracts) as total_contracts,
  (SELECT COUNT(*) FROM contracts WHERE client_id IS NOT NULL) as contracts_with_clients,
  (SELECT COUNT(*) FROM contracts WHERE client_id IS NULL) as contracts_needing_client_linking,
  (SELECT COUNT(*) FROM contracts WHERE generated_by IS NULL) as contracts_needing_user_assignment,
  (SELECT COUNT(*) FROM contracts WHERE signnow_document_id IS NOT NULL) as contracts_with_signnow_ids;

-- Show contracts that need manual cleanup
SELECT 'Contracts needing manual cleanup:' as cleanup_status;
SELECT * FROM get_contracts_needing_cleanup();
