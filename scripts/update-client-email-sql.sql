-- Update client email to jerry@jerrybony.me
-- Run this in Supabase SQL Editor

-- Step 1: Find the client_id from the contract
-- (This is just for verification - you can skip if you know the client_id)
SELECT
  c.id as contract_id,
  c.client_id,
  ci.email as current_email,
  ci.firstname,
  ci.lastname
FROM contracts c
JOIN client_info ci ON ci.id = c.client_id
WHERE c.id = '408ffdac-d440-4262-80c6-8a2eb8e7691f';

-- Step 2: Update the email
UPDATE client_info
SET email = 'jerry@jerrybony.me'
WHERE id = (
  SELECT client_id
  FROM contracts
  WHERE id = '408ffdac-d440-4262-80c6-8a2eb8e7691f'
);

-- Step 3: Verify the update
SELECT
  id as client_id,
  email,
  firstname,
  lastname,
  portal_status
FROM client_info
WHERE id = (
  SELECT client_id
  FROM contracts
  WHERE id = '408ffdac-d440-4262-80c6-8a2eb8e7691f'
);
