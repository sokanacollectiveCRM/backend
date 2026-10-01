-- Store Firebase UIDs on phi_clients and keep request workflow off client status.

ALTER TABLE public.phi_clients
  ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS request_status text;

COMMENT ON COLUMN public.phi_clients.user_id IS
  'Firebase Identity Platform uid for the client portal login.';
COMMENT ON COLUMN public.phi_clients.request_status IS
  'Request inbox status. Client lifecycle stays on phi_clients.status.';
