-- Optional specify-text when public intake primary language is Other.
-- Frontend also folds this value into primary_language for the existing column.
-- Safe to re-run. Do not run at boot; apply with the Cloud SQL migration runner:
--   npm run migrate:cloudsql -- src/db/migrations/20261009_phi_clients_primary_language_other.sql

ALTER TABLE public.phi_clients
  ADD COLUMN IF NOT EXISTS primary_language_other TEXT;

COMMENT ON COLUMN public.phi_clients.primary_language_other IS
  'Free-text language when public intake primary_language is Other. Frontend also stores the specified language in primary_language.';
