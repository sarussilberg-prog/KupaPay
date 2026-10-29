# Load test report (dev) — issue #425

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-10-28 |
| Harness | k6 + `load-test-manifest.json` (groups-list RPC trio) |
| Supabase project | `drxfbicunusmipdgbgdk` (dev only) |
| CI SQL proxy | `rpc_explain_performance.test.sql` (Docker SQL integration) |

## k6 against dev (REST, includes network)

GitHub Actions runner → dev, 10 VUs × 45 s, dedicated user `kupapay-loadtest-k6@kupay-dev.test` (5 groups, 100 expenses).

| RPC | p95 run 1 (ms) | p95 run 2 (ms) | Error rate |
|-----|----------------|----------------|------------|
| `get_user_simplified_inputs` | 496 | 989 | 0.00% |
| `get_user_groups_archive_state` | 250 | 704 | 0.00% |
| `get_activity_unread_count` | 237 | 712 | 0.00% |

Runs (2026-10-28 UTC): [run 1](https://github.com/sarussilberg-prog/KupaPay/actions/runs/40709023691) (1059 req, overall p95 292 ms), [run 2](https://github.com/sarussilberg-prog/KupaPay/actions/runs/40709264702) (741 req, medians ~250 ms).

**Reading:** errors pass. p95 fails the 300 ms bar. Even the trivial `get_activity_unread_count` swings from 237 to 712 ms between runs, and medians sit at 185–260 ms. That points to network distance and free-tier variance between the runner and dev, more than to the queries themselves. `get_user_simplified_inputs` is the only RPC that is consistently slowest. Next step: compare with server-side timings (`EXPLAIN ANALYZE` / `pg_stat_statements`) before tuning, and decide whether 300 ms end-to-end from a US runner is the right bar.

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
- [ ] p95 < 300 ms on dev REST: **not met** (237–989 ms across 2 runs; see above)
- [x] errors < 0.5%: 0.00% across 1800 requests

## Headroom summary

See [HEADROOM.md](./HEADROOM.md): at 1000 MAU, modeled Supabase REST volume ≈ **7%** of edge cap proxy; egress ≈ **42%** of 5 GB — monitor past **70%**.
