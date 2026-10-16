# Production migration repair — duplicate `20261016120000`

**Do not run against production without explicit approval.** This document is the runbook for fixing prod `db push` after [run 38875399557](https://github.com/sarussilberg-prog/KupaPay/actions/runs/38875399557) failed on a duplicate key in `supabase_migrations.schema_migrations.version`.

**Production project:** `jfqxjjjbpxbwwvoygahu`  
**Development (fixed filenames):** `drxfbicunusmipdgbgdk`

## Problem

On `main`, three migration **files** share the same version prefix `20261016120000`:

| File on `main` (broken) | Unique version on `dev` |
|-------------------------|-------------------------|
| `20261016120000_archive_group_rpc_result.sql` | `20261016120000` (unchanged) |
| `20261016120000_pro_trial_reminder_cron.sql` | `20261016120500_pro_trial_reminder_cron.sql` |
| `20261016120000_recurring_expenses.sql` | `20261016121500_recurring_expenses.sql` |

Supabase records one row per **version** string, not per filename. The CLI rejects duplicate versions, so prod never received the full batch.

## Target state (after `dev` → `main` merge)

Only these three versions exist in the repo (already true on `dev`):

1. `20261016120000` — `archive_group_rpc_result`
2. `20261016120500` — `pro_trial_reminder_cron`
3. `20261016121500` — `recurring_expenses`

Downstream migrations (`20261016121000_*`, …) stay ordered between / after these as on `dev`.

## Step 1 — Inspect prod (read-only)

Use the production DB URL (Dashboard → Settings → Database → connection string) with a superuser/service role session. **Never commit the URL.**

```sql
-- Migration history around the collision
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '20261016120000' AND version <= '20261016122000'
ORDER BY version;

-- Schema probes (which SQL actually landed)
SELECT pg_get_function_result('public.archive_group(uuid)') AS archive_group_returns;

SELECT to_regclass('public.recurring_expense_series') IS NOT NULL AS recurring_table;

SELECT jobname, schedule
FROM cron.job
WHERE jobname = 'pro-trial-reminder-dispatch-daily';
```

Interpretation:

| Probe | If true / JSONB | Meaning |
|-------|-----------------|--------|
| `archive_group_returns` = `jsonb` | | Archive RPC migration applied |
| `recurring_table` | | Recurring migration applied |
| cron row present | | Pro-trial cron migration applied |

## Step 2 — Choose repair path

Set `PROD_DB_URL` locally (session only):

```bash
export PROD_DB_URL='postgresql://postgres.[ref]:[password]@...'
cd cost-share-app
```

### Path A — No `20261016120000` row and probes false

Nothing from the batch is recorded or applied. **After** merging the renamed migrations from `dev` into `main`:

```bash
supabase db push --db-url "$PROD_DB_URL"
```

No `migration repair` needed.

### Path B — Exactly one `20261016120000` row (partial / ambiguous)

Identify which migration was recorded (check `name` column and probes above).

1. **Merge** `dev` migration filenames into `main` (remove duplicate-version files on `main`).
2. For each migration whose **SQL is already applied** but **version is missing** from history, mark applied **without re-running**:

```bash
# Example: archive_group JSONB live, history shows 20261016120000 archive_group only
supabase migration repair --status applied 20261016120000 --db-url "$PROD_DB_URL"

# Pro-trial cron live, not in history — use the NEW dev version after merge
supabase migration repair --status applied 20261016120500 --db-url "$PROD_DB_URL"

# Recurring tables live, not in history
supabase migration repair --status applied 20261016121500 --db-url "$PROD_DB_URL"
```

Only run repair lines for migrations confirmed by probes. Do **not** repair a version you still need `db push` to apply.

3. Apply remaining pending migrations:

```bash
supabase db push --db-url "$PROD_DB_URL"
```

### Path C — Erroneous `20261016120000` row but schema probes false

History says applied but schema missing (unlikely). Revert the bad history row, then push:

```bash
supabase migration repair --status reverted 20261016120000 --db-url "$PROD_DB_URL"
supabase db push --db-url "$PROD_DB_URL"
```

Use `--status reverted` only when you are certain the SQL did not land.

## Step 3 — Verify

```bash
supabase migration list --db-url "$PROD_DB_URL"
```

Confirm `20261016120000`, `20261016120500`, and `20261016121500` appear once each, and GitHub Actions prod deploy (`supabase-ci-db-push` on `main`) succeeds.

## Idempotency (safe re-apply on dev / repair)

Verified on `dev` branch migrations:

| Version | Idempotent mechanisms |
|---------|------------------------|
| `20261016120000` | `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE`; `ON CONFLICT DO NOTHING` on archive insert |
| `20261016120500` | `CREATE EXTENSION IF NOT EXISTS`; `CREATE OR REPLACE` function; cron job unschedule by name then `cron.schedule` |
| `20261016121500` | Header documents idempotency; `CREATE TABLE/INDEX IF NOT EXISTS`; `DROP TRIGGER/POLICY IF EXISTS`; `CREATE OR REPLACE` functions |

Re-running `db push` on dev after repair markers is safe.

## What this PR does **not** do

- Does **not** merge to `main` or execute prod repair commands.
- Does **not** modify production Supabase; it only documents the procedure and keeps dev migrations idempotent.

## Related

- [docs/SSOT/SUPABASE_MIGRATION_HISTORY_GAPS.md](SSOT/SUPABASE_MIGRATION_HISTORY_GAPS.md) — consolidation `20260628120000` history gap (dev/staging; separate from this prod blocker).
