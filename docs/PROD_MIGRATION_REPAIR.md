# Production migration repair — duplicate `20261016120000`

**Do not run against production without explicit approval.** Runbook for prod `db push` after drift on version `20261016120000` ([run 38875399557](https://github.com/sarussilberg-prog/KupaPay/actions/runs/38875399557), [run 40512392245](https://github.com/sarussilberg-prog/KupaPay/actions/runs/40512392245)).

**Production project:** `jfqxjjjbpxbwwvoygahu`  
**Development:** `drxfbicunusmipdgbgdk`

## What happened (repo history)

1. Three migration **files** on `main` briefly shared prefix `20261016120000` (`archive_group_rpc_result`, `pro_trial_reminder_cron`, `recurring_expenses`).
2. Production applied **pro-trial cron SQL** and recorded `schema_migrations.version = 20261016120000`, `name = pro_trial_reminder_cron`.
3. PR #218 follow-up (commit `44daf523`) renamed pro-trial and recurring to `20261016120500` / `20261016121500` but **kept** `20261016120000_archive_group_rpc_result.sql`, incorrectly assuming prod had recorded archive at that version.
4. CI drift check then failed: remote `pro_trial_reminder_cron` vs local `archive_group_rpc_result` at the same version.

**Was archive ever applied on prod under another version?** No — archive JSONB was never recorded on prod; `20261016320000_reapply_archive_group_rpc_result.sql` applies it idempotently on the next successful push.

**Does `pro_trial_reminder_cron` exist locally under another version?** It was at `20261016120500` on `dev`; the fix restores repo alignment at `20261016120000_pro_trial_reminder_cron.sql` to match production history.

## Target state (repo + production history)

| Version | Repo migration | Production `schema_migrations.name` |
|---------|----------------|-------------------------------------|
| `20261016120000` | `pro_trial_reminder_cron` | `pro_trial_reminder_cron` (unchanged) |
| `20261016121500` | `recurring_expenses` | pending until push |
| `20261016320000` | `reapply_archive_group_rpc_result` | pending until push (archive JSONB) |
| `20261016320100` | `reconcile_16120000_migration_history` | pending on prod (no-op SQL on prod) |

Production row `20261016120000` is **not** reverted or rewritten.

## Step 1 — Inspect prod (read-only)

Workflow dispatch on `deploy-production.yml`:

```bash
gh workflow run deploy-production.yml --ref main \
  -f prod_migration_repair=probe_only
```

Or run the SQL in the workflow `probe` job (see `.github/workflows/deploy-production.yml`).

Key probes:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '20261016120000' AND version <= '20261016122000' ORDER BY version;

SELECT pg_get_function_result('public.archive_group(uuid)'::regprocedure) AS archive_group_returns;

SELECT jobname FROM cron.job WHERE jobname = 'pro-trial-reminder-dispatch-daily';
```

Expect on prod today:

- `20261016120000` / `pro_trial_reminder_cron`
- Cron job present; `archive_group_returns` likely not `jsonb` until `20261016320000` runs

## Step 2 — Deploy (normal path after fix merge)

After `dev` → `main` merge containing this repair:

```bash
gh workflow run deploy-production.yml --ref main \
  -f prod_migration_repair=none
```

No `prod_migration_repair` mode is required when prod already has `20261016120000` = `pro_trial_reminder_cron` and the repo matches.

### Optional repair modes (legacy / edge cases)

| Input | When |
|-------|------|
| `path_b_pro_trial_applied` | Obsolete after repo uses `20261016120000` pro-trial file; kept for old runbooks |
| `path_b_recurring_applied` | Recurring schema live but `20261016121500` missing from history |
| `path_b_pro_trial_and_recurring_applied` | Both pro-trial (20500) and recurring already live — rare |
| `path_c_revert_20261016120000` | **Only** if probes show wrong row and SQL did not land |

## Step 3 — Verify

```bash
supabase migration list --db-url "$PROD_DB_URL"
```

Confirm drift check passes and pending tail (~35 migrations) applies.

## Idempotency

| Version | Safe re-run |
|---------|-------------|
| `20261016120000` | `CREATE OR REPLACE`; cron unschedule + schedule |
| `20261016320000` | `DROP FUNCTION IF EXISTS` + JSONB `archive_group` |
| `20261016320100` | History `DELETE`/`UPDATE` guarded by `EXISTS` (prod no-op) |
| `20261016121500` | Documented idempotent DDL in file header |

## Related

- [docs/SSOT/SUPABASE_MIGRATION_VERSIONS.md](SSOT/SUPABASE_MIGRATION_VERSIONS.md)
- [docs/SSOT/SUPABASE_MIGRATION_HISTORY_GAPS.md](SSOT/SUPABASE_MIGRATION_HISTORY_GAPS.md)
