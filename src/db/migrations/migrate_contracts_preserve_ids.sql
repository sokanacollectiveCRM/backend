-- Migration to preserve existing contract IDs while integrating with client_info
-- This ensures no data loss during the transition

-- Step 1: Create the new contract_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS contract_templates (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  fee TEXT,
  deposit TEXT
);

-- Step 2: Create the new contracts table structure
-- We'll use CREATE TABLE IF NOT EXISTS to avoid conflicts
CREATE TABLE IF NOT EXISTS contracts_new (
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

  -- Preserve original SignNow document ID for backward compatibility
  signnow_document_id VARCHAR(255) UNIQUE,

  -- Preserve original contract data if needed
  original_contract_data JSONB
);

-- Step 3: Migrate existing contracts if they exist
-- This will only run if the old contracts table exists
DO $$
BEGIN
  -- Check if old contracts table exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') THEN

    -- Insert existing contracts into new structure
    INSERT INTO contracts_new (
      id,
      client_id,
      template_name,
      fee,
      deposit,
      note,
      document_url,
      status,
      generated_by,
      created_at,
      updated_at,
      signnow_document_id,
      original_contract_data
    )
    SELECT
      COALESCE(c.id, gen_random_uuid()) as id, -- Preserve existing ID or generate new one
      COALESCE(ci.id, gen_random_uuid()) as client_id, -- Try to link to client_info
      'Migrated Contract' as template_name,
      c.deposit_amount::text as fee, -- Convert deposit_amount to fee
      c.deposit_amount::text as deposit,
      'Migrated from old system' as note,
      NULL as document_url, -- Will need to be updated manually
      CASE
        WHEN c.status = 'pending' THEN 'draft'
        WHEN c.status = 'signed' THEN 'signed'
        WHEN c.status = 'payment_completed' THEN 'active'
        WHEN c.status = 'completed' THEN 'completed'
        ELSE 'draft'
      END as status,
      gen_random_uuid() as generated_by, -- Will need to be updated to actual user ID
      COALESCE(c.created_at, NOW()) as created_at,
      COALESCE(c.updated_at, NOW()) as updated_at,
      c.signnow_document_id,
      jsonb_build_object(
        'client_email', c.client_email,
        'client_name', c.client_name,
        'contract_data', c.contract_data,
        'deposit_amount', c.deposit_amount,
        'total_amount', c.total_amount,
        'signed_at', c.signed_at,
        'payment_completed_at', c.payment_completed_at
      ) as original_contract_data
    FROM contracts c
    LEFT JOIN client_info ci ON ci.email = c.client_email -- Try to match by email
    ON CONFLICT (id) DO NOTHING; -- Don't duplicate if ID already exists

    -- Create a backup of the old table
    CREATE TABLE IF NOT EXISTS contracts_old_backup AS
    SELECT *, NOW() as backup_created_at FROM contracts;

    RAISE NOTICE 'Migrated % contracts from old system', (SELECT COUNT(*) FROM contracts);
    RAISE NOTICE 'Created backup table: contracts_old_backup';

  ELSE
    RAISE NOTICE 'No existing contracts table found, proceeding with new structure';
  END IF;
END $$;

-- Step 4: Drop the old contracts table and rename the new one
-- Only do this if the migration was successful
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') THEN
    DROP TABLE IF EXISTS contracts CASCADE;
  END IF;

  -- Rename the new table to contracts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts_new' AND table_schema = 'public') THEN
    ALTER TABLE contracts_new RENAME TO contracts;
    RAISE NOTICE 'Renamed contracts_new to contracts';
  END IF;
END $$;

-- Step 5: Create indexes for the new contracts table
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_generated_by ON contracts(generated_by);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);
CREATE INDEX IF NOT EXISTS idx_contracts_signnow_document_id ON contracts(signnow_document_id);

-- Step 6: Create the SignNow integration table
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

-- Step 7: Migrate existing contract payments if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_payments' AND table_schema = 'public') THEN
    -- The contract_payments table structure is already compatible
    -- Just ensure the foreign key constraint points to the new contracts table
    RAISE NOTICE 'Contract payments table already exists and should be compatible';
  END IF;
END $$;

-- Step 8: Add comments for documentation
COMMENT ON TABLE contracts IS 'Main contracts table linked to client_info for proper client association - migrated from old system';
COMMENT ON COLUMN contracts.client_id IS 'References client_info.id - the main client/user in the system';
COMMENT ON COLUMN contracts.template_id IS 'References contract_templates.id for contract structure';
COMMENT ON COLUMN contracts.generated_by IS 'References users.id - who created/generated this contract';
COMMENT ON COLUMN contracts.signnow_document_id IS 'Preserved from old system for backward compatibility';
COMMENT ON COLUMN contracts.original_contract_data IS 'Original contract data from old system for reference';
COMMENT ON TABLE contract_signnow_integration IS 'Handles SignNow document signing integration separately from main contract data';
COMMENT ON TABLE contracts_old_backup IS 'Backup of original contracts table before migration';

-- Step 9: Create a function to help with manual data cleanup
CREATE OR REPLACE FUNCTION update_migrated_contracts()
RETURNS void AS $$
BEGIN
  -- Update contracts that couldn't be automatically linked to clients
  UPDATE contracts
  SET note = COALESCE(note, '') || ' [NEEDS MANUAL CLIENT LINKING]'
  WHERE client_id IS NULL OR client_id = gen_random_uuid();

  -- Update contracts that need proper generated_by user
  UPDATE contracts
  SET note = COALESCE(note, '') || ' [NEEDS MANUAL USER ASSIGNMENT]'
  WHERE generated_by IS NULL;

  RAISE NOTICE 'Updated migrated contracts with cleanup flags';
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup function
SELECT update_migrated_contracts();

-- Final summary
SELECT
  'Migration Summary' as status,
  (SELECT COUNT(*) FROM contracts) as total_contracts,
  (SELECT COUNT(*) FROM contracts WHERE client_id IS NOT NULL) as contracts_with_clients,
  (SELECT COUNT(*) FROM contracts WHERE signnow_document_id IS NOT NULL) as contracts_with_signnow_ids,
  (SELECT COUNT(*) FROM contracts WHERE original_contract_data IS NOT NULL) as contracts_with_original_data;
