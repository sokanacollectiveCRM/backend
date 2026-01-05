-- Simple SQL to update client email
-- Run this in Supabase SQL Editor

UPDATE client_info
SET email = 'jerry@jerrybony.me'
WHERE id = (
  SELECT client_id
  FROM contracts
  WHERE id = '408ffdac-d440-4262-80c6-8a2eb8e7691f'
);

-- Verify the update
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
