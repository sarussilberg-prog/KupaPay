# Index review — MAU hot paths (#425)

Reviewed against `dev` migrations (2026-10-27). No new migration required for this issue.

## Groups list (3 RPCs in k6 manifest)

| RPC | Hot tables | Index / plan |
|-----|------------|----------------|
| `get_user_simplified_inputs` | `expenses`, `expense_splits`, `group_members` | `idx_expenses_group_active_created_desc` on `(group_id, created_at DESC) WHERE NOT is_deleted` — [`20261016321000_expenses_list_covering_index.sql`](../../supabase/migrations/20261016321000_expenses_list_covering_index.sql). CI guard: no seq scan on `expenses` at 600 rows — [`rpc_explain_performance.test.sql`](../../supabase/__tests__/rpc_explain_performance.test.sql). |
| `get_user_groups_archive_state` | `groups`, `group_members` | Membership filters use `group_members.user_id` / `group_id` (indexed via FK + RLS lint baseline). |
| `get_activity_unread_count` | `activity_events`, read cursors | `idx_activity_events_actor_user_id` — [`20261017203000_fe77_hot_path_rls_indexes.sql`](../../supabase/migrations/20261017203000_fe77_hot_path_rls_indexes.sql). |

## REST paths (not in k6, covered by EXPLAIN CI)

| Flow | Query pattern | Index |
|------|---------------|-------|
| Groups list | `group_members` ⋈ `groups` by `user_id` | Index on `group_members(user_id)` (FK) |
| Group expenses | `expenses` by `group_id`, `created_at DESC` | `idx_expenses_group_active_created_desc` |

## RLS / FK lint

[`supabase-sql-integration.yml`](../../../.github/workflows/supabase-sql-integration.yml) runs Splinter-style lints; unindexed FK violations are **enforced** via [`db-lint-baseline.json`](../../supabase/ci/db-lint-baseline.json).

## If p95 > 300 ms on dev k6

1. Re-run `EXPLAIN (ANALYZE, BUFFERS)` for failing RPC in Supabase SQL editor (dev project only).
2. Compare with local seeded volume in `rpc_explain_performance.test.sql`.
3. File a separate GitHub issue with plan output — do not expand #425 scope ad hoc.
