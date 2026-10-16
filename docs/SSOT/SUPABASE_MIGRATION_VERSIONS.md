# Supabase migration version prefixes

Supabase records **`schema_migrations.version`** as the **14-digit timestamp prefix** of each filename (`YYYYMMDDHHMMSS_name.sql`). Two files must not share the same prefix.

CI runs on every PR (see [docs/CI_CD.md](../CI_CD.md)):

- `supabase-lint-migration-filenames.sh` — naming rules
- `supabase-unique-migration-versions.sh` — duplicates on the PR branch
- `supabase-unique-migration-versions-at-merge.sh` — merge simulation against latest `origin/dev` / `origin/main` + pre-merge recheck in auto-merge

## Reserved / planned (avoid collisions)

| Version prefix   | Migration |
|------------------|-----------|
| `20261016131000` | PR #218 `security_idor_rate_limits` (rename from `20261016130000_*` before merge) |

`20261016130000` is used by `smart_payment_reminders` on `main`.
