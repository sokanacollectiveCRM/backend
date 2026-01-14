-- Add Mock Client Users to Database
-- This script creates mock client data including:
-- 1. Users in users table
-- 2. Client info in client_info table
-- 3. Contracts in contracts table
-- 4. Payments in contract_payments table

-- Note: This script does NOT create auth users in auth.users

-- ============================================================================
-- Mock Client Data
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_client_info_id UUID;
  v_contract_id UUID;
  v_payment_id UUID;
  v_index INT;
  v_mock_clients JSONB := '[
    {
      "email": "sarah.johnson@example.com",
      "firstname": "Sarah",
      "lastname": "Johnson",
      "phone_number": "3125550101",
      "city": "Chicago",
      "state": "IL",
      "zip_code": "60601",
      "service_needed": "Labor Support Services",
      "status": "active",
      "due_date": "2025-03-15"
    },
    {
      "email": "emily.chen@example.com",
      "firstname": "Emily",
      "lastname": "Chen",
      "phone_number": "3125550202",
      "city": "Chicago",
      "state": "IL",
      "zip_code": "60602",
      "service_needed": "Postpartum Doula Services",
      "status": "matching",
      "due_date": "2025-04-20"
    },
    {
      "email": "jessica.martinez@example.com",
      "firstname": "Jessica",
      "lastname": "Martinez",
      "phone_number": "3125550303",
      "city": "Evanston",
      "state": "IL",
      "zip_code": "60201",
      "service_needed": "Combined",
      "status": "active",
      "due_date": "2025-05-10"
    },
    {
      "email": "ashley.williams@example.com",
      "firstname": "Ashley",
      "lastname": "Williams",
      "phone_number": "3125550404",
      "city": "Oak Park",
      "state": "IL",
      "zip_code": "60301",
      "service_needed": "Labor Support Services",
      "status": "matching",
      "due_date": "2025-06-01"
    },
    {
      "email": "amanda.davis@example.com",
      "firstname": "Amanda",
      "lastname": "Davis",
      "phone_number": "3125550505",
      "city": "Chicago",
      "state": "IL",
      "zip_code": "60614",
      "service_needed": "Postpartum Doula Services",
      "status": "active",
      "due_date": "2025-07-15"
    }
  ]'::JSONB;
  v_client JSONB;
BEGIN
  RAISE NOTICE 'Creating mock client users...';
  RAISE NOTICE '========================================';

  FOR v_index IN 0..jsonb_array_length(v_mock_clients) - 1 LOOP
    v_client := v_mock_clients->v_index;

    BEGIN
      -- Step 1: Create user in users table
      INSERT INTO users (
        id,
        email,
        firstname,
        lastname,
        role,
        account_status,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        (v_client->>'email')::TEXT,
        (v_client->>'firstname')::TEXT,
        (v_client->>'lastname')::TEXT,
        'client',
        'active',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_user_id;

      RAISE NOTICE '✅ Created user: % (%)', v_client->>'email', v_user_id;

      -- Step 2: Create client_info record
      INSERT INTO client_info (
        user_id,
        email,
        firstname,
        lastname,
        phone_number,
        city,
        state,
        zip_code,
        service_needed,
        status,
        portal_status,
        due_date
      ) VALUES (
        v_user_id,
        (v_client->>'email')::TEXT,
        (v_client->>'firstname')::TEXT,
        (v_client->>'lastname')::TEXT,
        (v_client->>'phone_number')::TEXT,
        (v_client->>'city')::TEXT,
        (v_client->>'state')::TEXT,
        (v_client->>'zip_code')::TEXT,
        (v_client->>'service_needed')::TEXT,
        (v_client->>'status')::TEXT,
        'not_invited',
        (v_client->>'due_date')::DATE
      )
      RETURNING id INTO v_client_info_id;

      RAISE NOTICE '   ✅ Created client_info: %', v_client_info_id;

      -- Step 3: Create contract for this client
      INSERT INTO contracts (
        client_id,
        status,
        fee,
        deposit,
        note,
        created_at,
        updated_at
      ) VALUES (
        v_client_info_id,
        'signed',
        '3000',
        '600',
        'Mock contract for testing',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_contract_id;

      RAISE NOTICE '   ✅ Created contract: %', v_contract_id;

      -- Step 4: Create payment for this contract
      INSERT INTO contract_payments (
        contract_id,
        payment_type,
        status,
        amount,
        completed_at,
        created_at
      ) VALUES (
        v_contract_id,
        'deposit',
        'succeeded',
        600,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_payment_id;

      RAISE NOTICE '   ✅ Created payment: %', v_payment_id;
      RAISE NOTICE '';

    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE '⚠️  User already exists: % (skipping)', v_client->>'email';
      WHEN OTHERS THEN
        RAISE NOTICE '❌ Error creating user %: %', v_client->>'email', SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Mock client users creation complete!';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Verification: List all created mock clients with contracts and payments
-- ============================================================================
SELECT
  u.id as user_id,
  u.email,
  u.firstname,
  u.lastname,
  u.role,
  u.account_status,
  ci.id as client_info_id,
  ci.status as client_status,
  ci.portal_status,
  ci.service_needed,
  ci.due_date,
  ci.city,
  ci.state,
  c.id as contract_id,
  c.status as contract_status,
  c.fee as contract_fee,
  c.deposit as contract_deposit,
  cp.id as payment_id,
  cp.payment_type,
  cp.status as payment_status,
  cp.amount as payment_amount
FROM users u
INNER JOIN client_info ci ON ci.user_id = u.id
LEFT JOIN contracts c ON c.client_id = ci.id
LEFT JOIN contract_payments cp ON cp.contract_id = c.id AND cp.payment_type = 'deposit'
WHERE u.email IN (
  'sarah.johnson@example.com',
  'emily.chen@example.com',
  'jessica.martinez@example.com',
  'ashley.williams@example.com',
  'amanda.davis@example.com'
)
ORDER BY u.created_at DESC;
