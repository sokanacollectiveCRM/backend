-- Insert a row for the QA test client so the broker returns PHI.
-- Run this in Cloud SQL (sokana_private) against phi_clients.
-- Adjust values as needed; at least one PHI field should be non-null for the test.
-- If id is integer/serial, use DEFAULT or nextval('phi_clients_id_seq'::regclass) instead of gen_random_uuid().

INSERT INTO phi_clients (
  id,
  client_id,
  first_name,
  last_name,
  email,
  phone,
  date_of_birth,
  address_line1,
  due_date,
  health_history,
  allergies,
  medications
) VALUES (
  gen_random_uuid(),
  'ced55ced-c62c-48c0-81fb-353fe4a99cc4',
  'Test',
  'Client',
  'test@example.com',
  '+15551234567',
  '1990-01-15',
  '123 Test St',
  '2025-06-01',
  NULL,
  NULL,
  NULL
);
-- If your table has a unique constraint on client_id and you want to upsert instead:
-- Add: ON CONFLICT (client_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email, phone = EXCLUDED.phone, date_of_birth = EXCLUDED.date_of_birth, address_line1 = EXCLUDED.address_line1, due_date = EXCLUDED.due_date;
