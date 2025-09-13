-- Complete Database Schema View
-- Run this in Supabase SQL Editor to see all tables, columns, and relationships

-- 1. All tables and their columns
SELECT
    'TABLE' as object_type,
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    COALESCE(c.character_maximum_length::text, '') as character_maximum_length,
    '' as relationship_info
FROM
    information_schema.tables t
LEFT JOIN
    information_schema.columns c ON t.table_name = c.table_name
WHERE
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'

UNION ALL

-- 2. Foreign key relationships
SELECT
    'FOREIGN KEY' as object_type,
    tc.table_name as table_name,
    kcu.column_name as column_name,
    'REFERENCES' as data_type,
    ccu.table_name as is_nullable,
    ccu.column_name as column_default,
    '' as character_maximum_length,
    tc.constraint_name as relationship_info
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'

ORDER BY
    object_type, table_name, column_name;
