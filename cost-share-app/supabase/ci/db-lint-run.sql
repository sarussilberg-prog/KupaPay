-- Supabase-style DB lints (Splinter-compatible checks) for local SQL CI.
-- Fails with RAISE EXCEPTION when violations exceed db-lint-baseline.json.
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _db_lint_violations (
  lint_type TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  detail TEXT NOT NULL,
  PRIMARY KEY (lint_type, cache_key)
);

TRUNCATE _db_lint_violations;

-- 0001 unindexed foreign keys (public + app schemas only)
INSERT INTO _db_lint_violations (lint_type, cache_key, detail)
WITH foreign_keys AS (
    SELECT
        ns.nspname AS schema_name,
        cl.relname AS table_name,
        cl.oid AS table_oid,
        ct.conname AS fkey_name,
        ct.conkey AS col_attnums
    FROM pg_catalog.pg_constraint ct
    JOIN pg_catalog.pg_class cl ON ct.conrelid = cl.oid
    JOIN pg_catalog.pg_namespace ns ON cl.relnamespace = ns.oid
    LEFT JOIN pg_catalog.pg_depend d
        ON d.objid = cl.oid
        AND d.deptype = 'e'
        AND d.classid = 'pg_catalog.pg_class'::regclass
    WHERE ct.contype = 'f'
      AND d.objid IS NULL
      AND ns.nspname = 'public'
),
index_ AS (
    SELECT
        pi.indrelid AS table_oid,
        indexrelid::regclass AS index_,
        string_to_array(pi.indkey::text, ' ')::smallint[] AS col_attnums
    FROM pg_catalog.pg_index pi
    WHERE pi.indisvalid
)
SELECT
    'unindexed_foreign_keys',
    format('unindexed_foreign_keys_%s_%s_%s', fk.schema_name, fk.table_name, fk.fkey_name),
    format(
        'Table %I.%I has foreign key %I without a covering index.',
        fk.schema_name, fk.table_name, fk.fkey_name
    )
FROM foreign_keys fk
LEFT JOIN index_ idx
    ON fk.table_oid = idx.table_oid
    AND fk.col_attnums = idx.col_attnums[1:array_length(fk.col_attnums, 1)]
WHERE idx.index_ IS NULL;

-- 0003 auth_rls_initplan
INSERT INTO _db_lint_violations (lint_type, cache_key, detail)
WITH policies AS (
    SELECT
        nsp.nspname AS schema_name,
        pc.relname AS table_name,
        pc.relrowsecurity AS is_rls_active,
        pa.polname AS policy_name,
        pb.qual,
        pb.with_check
    FROM pg_catalog.pg_policy pa
    JOIN pg_catalog.pg_class pc ON pa.polrelid = pc.oid
    JOIN pg_catalog.pg_namespace nsp ON pc.relnamespace = nsp.oid
    JOIN pg_catalog.pg_policies pb
        ON pc.relname = pb.tablename
        AND nsp.nspname = pb.schemaname
        AND pa.polname = pb.policyname
)
SELECT
    'auth_rls_initplan',
    format('auth_rls_init_plan_%s_%s_%s', schema_name, table_name, policy_name),
    format(
        'RLS policy %I on %I.%I uses auth.* or current_setting() without (select ...) wrapper.',
        policy_name, schema_name, table_name
    )
FROM policies
WHERE is_rls_active
  AND schema_name = 'public'
  AND (
        (qual LIKE '%auth.uid()%' AND lower(qual) NOT LIKE '%select auth.uid()%')
     OR (qual LIKE '%auth.jwt()%' AND lower(qual) NOT LIKE '%select auth.jwt()%')
     OR (qual LIKE '%auth.role()%' AND lower(qual) NOT LIKE '%select auth.role()%')
     OR (qual LIKE '%auth.email()%' AND lower(qual) NOT LIKE '%select auth.email()%')
     OR (qual LIKE '%current\_setting(%)%' AND lower(qual) NOT LIKE '%select current\_setting(%)%')
     OR (with_check LIKE '%auth.uid()%' AND lower(with_check) NOT LIKE '%select auth.uid()%')
     OR (with_check LIKE '%auth.jwt()%' AND lower(with_check) NOT LIKE '%select auth.jwt()%')
     OR (with_check LIKE '%auth.role()%' AND lower(with_check) NOT LIKE '%select auth.role()%')
     OR (with_check LIKE '%auth.email()%' AND lower(with_check) NOT LIKE '%select auth.email()%')
     OR (with_check LIKE '%current\_setting(%)%' AND lower(with_check) NOT LIKE '%select current\_setting(%)%')
  );

-- RLS filter columns: policies that compare user_id / group_id should have a usable index.
INSERT INTO _db_lint_violations (lint_type, cache_key, detail)
WITH rls_tables AS (
    SELECT DISTINCT n.nspname AS schema_name, c.relname AS table_name, c.oid AS table_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
),
policy_cols AS (
    SELECT
        pb.schemaname AS schema_name,
        pb.tablename AS table_name,
        col AS column_name
    FROM pg_policies pb
    CROSS JOIN LATERAL (
        SELECT unnest(ARRAY['user_id', 'group_id', 'created_by']) AS col
    ) cols
    WHERE pb.schemaname = 'public'
      AND (
            pb.qual ILIKE ('%' || col || '%')
         OR pb.with_check ILIKE ('%' || col || '%')
      )
),
needs_index AS (
    SELECT DISTINCT pc.schema_name, pc.table_name, pc.column_name, rt.table_oid
    FROM policy_cols pc
    JOIN rls_tables rt
        ON rt.schema_name = pc.schema_name
        AND rt.table_name = pc.table_name
),
indexed AS (
    SELECT
        ni.schema_name,
        ni.table_name,
        ni.column_name,
        EXISTS (
            SELECT 1
            FROM pg_index pi
            JOIN pg_attribute pa
                ON pa.attrelid = pi.indrelid
                AND pa.attnum = ANY (pi.indkey::smallint[])
            JOIN pg_class ic ON ic.oid = pi.indrelid
            JOIN pg_namespace ns ON ns.oid = ic.relnamespace
            WHERE ns.nspname = ni.schema_name
              AND ic.relname = ni.table_name
              AND pa.attname = ni.column_name
              AND pi.indisvalid
        ) AS has_index
    FROM needs_index ni
)
SELECT
    'rls_filter_columns_missing_index',
    format('rls_col_index_%s_%s_%s', schema_name, table_name, column_name),
    format(
        'Table %I.%I is filtered on %I in RLS but no index includes that column.',
        schema_name, table_name, column_name
    )
FROM indexed
WHERE NOT has_index;

-- public base tables must have RLS enabled (PostgREST exposure).
INSERT INTO _db_lint_violations (lint_type, cache_key, detail)
SELECT
    'public_tables_without_rls',
    format('public_table_no_rls_%s', c.relname),
    format('Table public.%I exists but row level security is disabled.', c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity;

-- SECURITY DEFINER functions must pin search_path (search_path injection).
INSERT INTO _db_lint_violations (lint_type, cache_key, detail)
SELECT
    'security_definer_missing_search_path',
    format(
        'definer_no_search_path_%s_%s_%s',
        n.nspname,
        p.proname,
        md5(pg_get_function_identity_arguments(p.oid))
    ),
    format(
        'Function %I.%I(%s) is SECURITY DEFINER but has no SET search_path.',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
    )
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
  AND n.nspname IN ('public', 'app_private')
  AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(opt)
        WHERE opt LIKE 'search_path=%'
    );

-- Final row set consumed by ci-compare-db-lint-baseline.sh (lint_type|cache_key)
\pset tuples_only on
\pset footer off
SELECT lint_type, cache_key FROM _db_lint_violations ORDER BY lint_type, cache_key;

COMMIT;
