-- Export public table columns and RPC identity args for schema contract tests (SQL CI).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

SELECT 'table|' || c.table_name || '|' || c.column_name || '|' || c.udt_name || '|' || c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name NOT LIKE 'pg_%'
ORDER BY c.table_name, c.ordinal_position;

SELECT 'function|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);
