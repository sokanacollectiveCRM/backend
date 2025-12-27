-- Fix foreign key constraint on contracts.generated_by to allow user deletion
-- This migration updates the foreign key to SET NULL on delete, preserving contract records
-- while allowing users to be deleted even if they generated contracts

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_generated_by_fkey;

-- Step 2: Add the foreign key constraint with ON DELETE SET NULL
-- This allows contracts to be preserved when the user who generated them is deleted
ALTER TABLE contracts
  ADD CONSTRAINT contracts_generated_by_fkey
  FOREIGN KEY (generated_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- Note: If you need to update existing contracts where the user no longer exists,
-- you can run this query after dropping the constraint:
-- UPDATE contracts SET generated_by = NULL WHERE generated_by NOT IN (SELECT id FROM users);
