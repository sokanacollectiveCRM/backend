-- Safe test table for Cloud SQL read/write connectivity. No application data.
-- Run once: psql ... -f migrations/cloudsql_connectivity_test_table.sql

CREATE TABLE IF NOT EXISTS public.cloudsql_connectivity_test (
  id         SERIAL PRIMARY KEY,
  value      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cloudsql_connectivity_test IS 'Used only by read/write connectivity tests; do not store real data.';
