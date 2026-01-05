# Manual Portal Invite Setup Guide

If you prefer to create the test data manually in Supabase, follow these steps:

## Step 1: Create a Client Record

In the `client_info` table, insert a new record with:

```sql
INSERT INTO client_info (
  email,
  firstname,
  lastname,
  status,
  portal_status
) VALUES (
  'test-portal-client@example.com',
  'Test',
  'Portal Client',
  'active',
  'not_invited'
);
```

**Note the `id` of the created client** - you'll need it for the next steps.

## Step 2: Create a Signed Contract

In the `contracts` table, insert a record linked to your client:

```sql
INSERT INTO contracts (
  client_id,
  status,
  fee,
  deposit,
  template_name,
  updated_at
) VALUES (
  '<CLIENT_ID_FROM_STEP_1>',  -- Replace with actual client ID
  'signed',
  '$3000',
  '$500',
  'Test Portal Contract',
  NOW()
);
```

**Note the `id` of the created contract** - you'll need it for the next step.

## Step 3: Create a Completed Deposit Payment

In the `contract_payments` table, insert a completed deposit payment:

```sql
INSERT INTO contract_payments (
  contract_id,
  payment_type,
  amount,
  status,
  completed_at,
  stripe_payment_intent_id
) VALUES (
  '<CONTRACT_ID_FROM_STEP_2>',  -- Replace with actual contract ID
  'deposit',
  500.00,
  'succeeded',
  NOW(),
  'test_pi_' || EXTRACT(EPOCH FROM NOW())::text
);
```

## Step 4: Verify Eligibility

Run this query to verify the client is eligible:

```sql
SELECT
  ci.id as client_id,
  ci.email,
  ci.portal_status,
  c.id as contract_id,
  c.status as contract_status,
  cp.id as payment_id,
  cp.status as payment_status,
  cp.payment_type
FROM client_info ci
JOIN contracts c ON c.client_id = ci.id AND c.status = 'signed'
JOIN contract_payments cp ON cp.contract_id = c.id
  AND cp.payment_type = 'deposit'
  AND cp.status = 'succeeded'
WHERE ci.id = '<CLIENT_ID_FROM_STEP_1>';
```

If this returns a row, the client is eligible for portal invite!

## Step 5: Test the Portal Invite

Once you have the client ID, you can test the invite endpoint:

```bash
# Login as admin first to get token
# Then call:
POST /api/admin/clients/<CLIENT_ID>/portal/invite
Authorization: Bearer <ADMIN_TOKEN>
```

Or use the test script:

```bash
npx tsx scripts/test-portal-invite-full.ts
```

## Quick SQL Script (All-in-One)

Here's a complete SQL script you can run in Supabase SQL Editor:

```sql
-- Step 1: Create client
INSERT INTO client_info (email, firstname, lastname, status, portal_status)
VALUES ('test-portal-' || EXTRACT(EPOCH FROM NOW())::text || '@example.com', 'Test', 'Portal Client', 'active', 'not_invited')
RETURNING id as client_id;

-- Step 2: Create contract (replace <CLIENT_ID> with result from Step 1)
INSERT INTO contracts (client_id, status, fee, deposit, template_name, updated_at)
VALUES ('<CLIENT_ID>', 'signed', '$3000', '$500', 'Test Portal Contract', NOW())
RETURNING id as contract_id;

-- Step 3: Create payment (replace <CONTRACT_ID> with result from Step 2)
INSERT INTO contract_payments (contract_id, payment_type, amount, status, completed_at, stripe_payment_intent_id)
VALUES ('<CONTRACT_ID>', 'deposit', 500.00, 'succeeded', NOW(), 'test_pi_' || EXTRACT(EPOCH FROM NOW())::text)
RETURNING id as payment_id;
```

## Requirements Summary

For a client to be eligible for portal invite:

- ✅ Client exists in `client_info` table
- ✅ Client has a contract with `status = 'signed'`
- ✅ Contract has a payment with `payment_type = 'deposit'` AND
  `status = 'succeeded'`
