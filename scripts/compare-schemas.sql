-- Compare lad_dev and lad_stage schemas to find differences
-- This script identifies tables, columns, indexes, and constraints that differ between schemas

\echo '================================================'
\echo 'Schema Comparison: lad_dev vs lad_stage'
\echo '================================================'
\echo ''

-- Check if both schemas exist
\echo 'Checking schema existence...'
SELECT 
    schema_name,
    CASE 
        WHEN schema_name = 'lad_dev' THEN '✓ Source schema exists'
        WHEN schema_name = 'lad_stage' THEN '✓ Target schema exists'
    END as status
FROM information_schema.schemata
WHERE schema_name IN ('lad_dev', 'lad_stage')
ORDER BY schema_name;

\echo ''
\echo '================================================'
\echo '1. Tables in lad_dev but NOT in lad_stage'
\echo '================================================'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'lad_dev'
  AND table_name NOT IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'lad_stage'
  )
ORDER BY table_name;

\echo ''
\echo '================================================'
\echo '2. Tables in lad_stage but NOT in lad_dev'
\echo '================================================'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'lad_stage'
  AND table_name NOT IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'lad_dev'
  )
ORDER BY table_name;

\echo ''
\echo '================================================'
\echo '3. Column differences in common tables'
\echo '================================================'
WITH dev_columns AS (
    SELECT 
        table_name,
        column_name,
        data_type,
        column_default,
        is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'lad_dev'
),
stage_columns AS (
    SELECT 
        table_name,
        column_name,
        data_type,
        column_default,
        is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'lad_stage'
),
missing_in_stage AS (
    SELECT 
        table_name,
        column_name,
        data_type,
        'Missing in lad_stage' as status
    FROM dev_columns
    WHERE (table_name, column_name) NOT IN (
        SELECT table_name, column_name FROM stage_columns
    )
),
missing_in_dev AS (
    SELECT 
        table_name,
        column_name,
        data_type,
        'Extra in lad_stage' as status
    FROM stage_columns
    WHERE (table_name, column_name) NOT IN (
        SELECT table_name, column_name FROM dev_columns
    )
)
SELECT * FROM missing_in_stage
UNION ALL
SELECT * FROM missing_in_dev
ORDER BY table_name, column_name;

\echo ''
\echo '================================================'
\echo '4. Index differences'
\echo '================================================'
WITH dev_indexes AS (
    SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = 'lad_dev'
),
stage_indexes AS (
    SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = 'lad_stage'
)
SELECT 
    tablename,
    indexname,
    'Missing in lad_stage' as status
FROM dev_indexes
WHERE indexname NOT IN (
    SELECT REPLACE(indexname, 'lad_stage', 'lad_dev') 
    FROM stage_indexes
)
UNION ALL
SELECT 
    tablename,
    indexname,
    'Extra in lad_stage' as status
FROM stage_indexes
WHERE indexname NOT IN (
    SELECT REPLACE(indexname, 'lad_dev', 'lad_stage')
    FROM dev_indexes
)
ORDER BY tablename, indexname;

\echo ''
\echo '================================================'
\echo 'Summary'
\echo '================================================'
SELECT 
    'lad_dev' as schema,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'lad_dev'
  AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'lad_stage' as schema,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'lad_stage'
  AND table_type = 'BASE TABLE';
