-- One login may have separate staff profiles in several organizations.
-- Apply as the table owner before deploying cross-organization invitations.
-- Does not merge/delete accounts or change any existing memberships.
BEGIN;

DO $$
DECLARE
  staff_table text;
  unique_index record;
BEGIN
  FOREACH staff_table IN ARRAY ARRAY['admins', 'doulas'] LOOP
    -- Remove only single-column global email/UID uniqueness, including indexes
    -- backing UNIQUE constraints. Keep primary keys and unrelated indexes.
    FOR unique_index IN
      SELECT i.indexrelid::regclass AS index_name, c.conname AS constraint_name
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
      LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid
      WHERE n.nspname = 'public' AND t.relname = staff_table
        AND i.indisunique AND NOT i.indisprimary AND i.indnkeyatts = 1
        AND a.attname IN ('email', 'identity_platform_uid')
    LOOP
      IF unique_index.constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', staff_table, unique_index.constraint_name);
      ELSE
        EXECUTE format('DROP INDEX %s', unique_index.index_name);
      END IF;
    END LOOP;
    -- Handle the legacy case-insensitive global index too. Match its expression,
    -- not its name, and never drop unrelated expression indexes.
    FOR unique_index IN
      SELECT i.indexrelid::regclass AS index_name, pg_get_expr(i.indexprs, i.indrelid) AS expression
      FROM pg_index i
      WHERE i.indrelid = format('public.%I', staff_table)::regclass
        AND i.indisunique AND NOT i.indisprimary AND i.indnkeyatts = 1
        AND pg_get_expr(i.indexprs, i.indrelid) IN (
          'lower(email)', 'lower((email)::text)',
          'lower(TRIM(BOTH FROM email))', 'lower(btrim(email))',
          'lower(TRIM(BOTH FROM full_name))', 'lower(btrim(full_name))'
        )
    LOOP
      EXECUTE format('DROP INDEX %s', unique_index.index_name);
      IF unique_index.expression LIKE '%full_name%' THEN
        EXECUTE format(
          'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, lower(btrim(full_name)))',
          'idx_' || staff_table || '_tenant_name_unique', staff_table
        );
      END IF;
    END LOOP;
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, lower(btrim(email)))',
      'idx_' || staff_table || '_tenant_email_unique', staff_table
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, identity_platform_uid) WHERE identity_platform_uid IS NOT NULL',
      'idx_' || staff_table || '_tenant_identity_unique', staff_table
    );
  END LOOP;
END $$;

-- Prevent competing acceptances from creating a second staff membership.
-- Pre-existing duplicates make the migration fail atomically for review.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_tenant_staff_email_unique
  ON public.memberships (tenant_id, lower(btrim(email)))
  WHERE principal_type IN ('admin', 'doula');

COMMIT;
