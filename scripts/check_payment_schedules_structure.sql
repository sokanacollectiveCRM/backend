-- Check the current structure of payment_schedules table
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payment_schedules' AND table_schema = 'public'
ORDER BY ordinal_position;
