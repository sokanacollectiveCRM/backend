-- Create contracts table to link SignNow documents with payment data
CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signnow_document_id VARCHAR(255) UNIQUE NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  contract_data JSONB NOT NULL, -- Store all contract details (hours, rates, amounts)
  deposit_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, signed, payment_completed, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signed_at TIMESTAMP WITH TIME ZONE,
  payment_completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_signnow_document_id ON contracts(signnow_document_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client_email ON contracts(client_email);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Create payments table to track payment history
CREATE TABLE IF NOT EXISTS contract_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL, -- deposit, installment, final
  status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, canceled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract_id ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_stripe_intent_id ON contract_payments(stripe_payment_intent_id);
