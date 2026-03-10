-- Add unique client_number to phi_clients for internal tracking.
-- Generated when a new client submits the intake/request form.
-- Format: CL-NNNNN (e.g., CL-00001, CL-00002)
-- Run on sokana_private (Cloud SQL).

-- Sequence for unique numbering (thread-safe, no duplicates)
CREATE SEQUENCE IF NOT EXISTS phi_clients_client_number_seq START 1;

-- Add column (nullable for existing rows; new rows get value from insert)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'phi_clients' AND column_name = 'client_number') THEN
    ALTER TABLE public.phi_clients ADD COLUMN client_number text;
  END IF;
END $$;

-- Unique constraint so we never have duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_phi_clients_client_number
  ON public.phi_clients (client_number)
  WHERE client_number IS NOT NULL;

COMMENT ON COLUMN public.phi_clients.client_number IS 'Unique human-readable client identifier (e.g., CL-00001). Generated on intake form submission.';
