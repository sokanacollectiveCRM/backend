-- Enhance assignments table with additional useful columns
-- Run this in Supabase SQL Editor

-- Add status column (active, completed, cancelled)
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Add notes column for assignment details
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add created_at column
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add updated_at column
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assignments_updated_at ON assignments;

CREATE TRIGGER trigger_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignments_updated_at();

-- Add unique constraint to prevent duplicate assignments
ALTER TABLE assignments
ADD CONSTRAINT unique_doula_client
UNIQUE (doula_id, client_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_doula_id ON assignments(doula_id);
CREATE INDEX IF NOT EXISTS idx_assignments_client_id ON assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'assignments'
ORDER BY ordinal_position;
