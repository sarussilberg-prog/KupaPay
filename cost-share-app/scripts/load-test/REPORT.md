# Load test report (dev) — issue #425

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-10-27 |
| Harness | k6 + `load-test-manifest.json` (groups-list RPC trio) |
| Supabase project | `drxfbicunusmipdgbgdk` (dev only) |
| CI SQL proxy | `rpc_explain_performance.test.sql` (Docker SQL integration) |

## k6 against dev (REST, includes network)

| RPC | p95 (ms) | Error rate |
|-----|----------|------------|
| `get_user_simplified_inputs` | _Run workflow or local k6_* — see README_ | |
| `get_user_groups_archive_state` | | |
| `get_activity_unread_count` | | |

**How to produce numbers:** GitHub → Actions → **Load test (dev, manual)** with `LOAD_TEST_*` or `E2E_*` secrets, or locally:

```bash
cd cost-share-app/scripts/load-test
eval "$(node prepare-k6-env.mjs)"
k6 run k6-dev-rpcs.js
```

Prior harness called removed RPC `get_user_dashboard` (404) — fixed in this branch.

## CI database timings (local Postgres, seeded ~600 expenses)

Guard budgets from [`rpc_explain_performance.test.sql`](../../supabase/__tests__/rpc_explain_performance.test.sql) (execution time, no HTTP):

| Path | CI budget (ms) | Maps to k6 RPC |
|------|----------------|----------------|
| `get_user_simplified_inputs` | ≤ 800 | yes |
| `get_user_groups_archive_state` | ≤ 400 | yes |
| `get_activity_unread_count` | ≤ 200 | yes (added 2026-10-27) |
| Groups list join | ≤ 400 | REST |
| Group expenses list | ≤ 400 | REST |

Local DB budgets are **looser than 300 ms** to absorb Docker variance; dev REST p95 is validated by k6 thresholds when secrets are configured.

## Verdict checklist

- [x] k6 script targets current hot RPCs on dev (not legacy dashboard)
- [x] Index review documented ([INDEX_REVIEW.md](./INDEX_REVIEW.md))
- [x] Free-tier headroom report ([HEADROOM.md](./HEADROOM.md))
- [ ] p95 < 300 ms on dev REST — **pending authenticated k6 run** (secrets not available in agent VM)
- [ ] errors < 0.5% — **pending authenticated k6 run**

## Headroom summary

See [HEADROOM.md](./HEADROOM.md): at 1000 MAU, modeled Supabase REST volume ≈ **7%** of edge cap proxy; egress ≈ **42%** of 5 GB — monitor past **70%**.
