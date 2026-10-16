# Supabase migration history gaps (dev vs repo)

## Symptom

`supabase db push` fails with:

```text
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20260628120000_consolidation_batches.sql
```

## Cause (development `drxfbicunusmipdgbgdk`)

- Remote history includes **newer** repo versions (e.g. post-`20260628120000`) while **`20260628120000` is not recorded**.
- Common after MCP-applied SQL with non-repo version timestamps; `supabase-ci-db-push.sh` reverts remote-only versions, but **schema objects remain**.
- Staging run [38877009400](https://github.com/sarussilberg-prog/KupaPay/actions/runs/38877009400) (attempt 2): reverted MCP ids, then hit this gap on `20260628120000`.

## Is the SQL missing?

**Usually no.** `consolidation_batches` and related RPCs are required by later migrations (`20260701140000_*`, app code). The gap is **history-only** unless the table probe fails.

Verify in dev SQL editor:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version = '20260628120000';

SELECT to_regclass('public.consolidation_batches') IS NOT NULL AS consolidation_batches_table;
```

## CI behaviour

`scripts/supabase-ci-db-push.sh` retries with **`db push --include-all`** when the message above appears. Migrations must stay idempotent.

Manual repair alternative (if `--include-all` is undesirable):

```bash
supabase migration repair --status applied 20260628120000 --db-url "$DB_URL"
```

Only use repair when the consolidation schema probe is true.

## Production (#233)

Prod deploy logs ([38875399557](https://github.com/sarussilberg-prog/KupaPay/actions/runs/38875399557)) failed on **duplicate `20261016120000`**, not on an “inserted before” gap. Pending push started at `20261016120000_*`, so **`20260628120000` is already in prod history** — the consolidation gap is a **dev/staging** issue, not a blocker for #233’s prod push once version-prefix collisions are fixed.
