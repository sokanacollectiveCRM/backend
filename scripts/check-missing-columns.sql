-- Check which columns from OPERATIONAL_UPDATE_COLUMNS actually exist in client_info

-- List all columns in client_info table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_info'
ORDER BY ordinal_position;

-- Check specific columns that might be missing
SELECT
  col.column_name,
  CASE WHEN col.column_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  VALUES
    ('status'),
    ('service_needed'),
    ('portal_status'),
    ('services_interested'),
    ('service_specifics'),
    ('service_support_details'),
    ('birth_location'),
    ('birth_hospital'),
    ('baby_name'),
    ('baby_sex'),
    ('number_of_babies'),
    ('due_date'),
    ('date_of_birth'),
    ('children_expected'),
    ('pronouns'),
    ('preferred_name'),
    ('payment_method'),
    ('home_type'),
    ('provider_type'),
    ('pregnancy_number'),
    ('had_previous_pregnancies'),
    ('previous_pregnancies_count'),
    ('living_children_count'),
    ('race_ethnicity'),
    ('primary_language'),
    ('client_age_range'),
    ('insurance'),
    ('profile_picture')
) AS expected(column_name)
LEFT JOIN information_schema.columns col
  ON col.table_name = 'client_info'
  AND col.table_schema = 'public'
  AND col.column_name = expected.column_name
ORDER BY status, expected.column_name;
