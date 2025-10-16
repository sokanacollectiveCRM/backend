-- Fix all fields that are storing text values but defined as INTEGER
-- These fields need to be TEXT type because the frontend sends descriptive values

ALTER TABLE client_info
ALTER COLUMN number_of_babies TYPE TEXT,
ALTER COLUMN pregnancy_number TYPE TEXT,
ALTER COLUMN previous_pregnancies_count TYPE TEXT,
ALTER COLUMN living_children_count TYPE TEXT;

-- Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_info'
AND column_name IN ('number_of_babies', 'pregnancy_number', 'previous_pregnancies_count', 'living_children_count', 'children_expected')
ORDER BY column_name;
