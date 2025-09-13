-- View all tables and their structure
SELECT
    t.table_name,
    t.table_type,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length
FROM
    information_schema.tables t
LEFT JOIN
    information_schema.columns c ON t.table_name = c.table_name
WHERE
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY
    t.table_name, c.ordinal_position;
