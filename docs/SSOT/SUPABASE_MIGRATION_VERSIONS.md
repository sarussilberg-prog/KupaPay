# Supabase migration version prefixes

Supabase records **`schema_migrations.version`** as the **14-digit timestamp prefix** of each filename (`YYYYMMDDHHMMSS_name.sql`). Two files must not share the same prefix.

CI runs `cost-share-app/scripts/supabase-unique-migration-versions.sh` on every PR.

## Reserved / planned (avoid collisions)

| Version prefix   | Migration |
|------------------|-----------|
| `20261016131000` | PR #218 `security_idor_rate_limits` (rename from `20261016130000_*` before merge) |

`20261016130000` is used by `smart_payment_reminders` on `main`.
