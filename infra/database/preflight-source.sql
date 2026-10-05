-- Source inventory only. Run with psql -X -v ON_ERROR_STOP=1.
-- No application bootstrap, migration, seed, backup or remote image recovery.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database, current_setting('server_version') AS version,
       current_setting('server_encoding') AS encoding,
       pg_size_pretty(pg_database_size(current_database())) AS size;
SELECT extname, extversion FROM pg_extension ORDER BY extname;
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema'
ORDER BY schema_name;

-- Exact counts within one consistent read-only snapshot; no private row values.
SELECT format('SELECT %L AS relation, count(*) AS rows FROM %I.%I;',
              schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname IN ('public', 'drizzle')
ORDER BY schemaname, tablename
\gexec

SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname IN ('public', 'drizzle') ORDER BY 1, 2, 3;
SELECT n.nspname AS schema, r.relname AS relation, c.conname, c.contype,
       c.convalidated, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class r ON r.oid = c.conrelid
WHERE n.nspname IN ('public', 'drizzle') ORDER BY 1, 2, 3;
SELECT schemaname, sequencename, data_type, start_value, increment_by, last_value
FROM pg_sequences WHERE schemaname IN ('public', 'drizzle') ORDER BY 1, 2;
SELECT t.typname AS enum, e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder;
SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'drizzle')
AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
                AND d.objid = p.oid AND d.deptype = 'e') ORDER BY p.proname;
SELECT t.tgname, c.relname AS relation, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'drizzle') AND NOT t.tgisinternal ORDER BY t.tgname;

SELECT count(*) AS migrations, max(created_at) AS latest_created_at
FROM drizzle.__drizzle_migrations;
SELECT state, count(*) AS operations FROM public.catalog_image_operations
GROUP BY state ORDER BY state;
SELECT count(*) AS negative_balances FROM public.inventory_balances
WHERE available_quantity < 0;
SELECT CASE WHEN url LIKE 'https://picsum.photos/%' THEN 'picsum'
            WHEN url LIKE 'https://res.cloudinary.com/%' THEN 'cloudinary'
            ELSE 'local_or_other' END AS provider, count(*)
FROM public.product_images GROUP BY 1 ORDER BY 1;
COMMIT;
