# Load test — dev Supabase RPCs (#425)

Uses [k6](https://k6.io/) (open source, free). Targets **development** only (`drxfbicunusmipdgbgdk`).

## Prerequisites

```bash
# macOS / Linux
brew install k6
```

## Run

```bash
cd cost-share-app/scripts/load-test
export SUPABASE_URL="https://drxfbicunusmipdgbgdk.supabase.co"
export SUPABASE_ANON_KEY="<dev anon key>"
export K6_USER_JWT="<authenticated user JWT for a test account>"
export K6_USER_ID="<same user's UUID>"
k6 run k6-dev-rpcs.js
```

Optional tuning:

| Env | Default | Purpose |
|-----|---------|---------|
| `K6_VUS` | `15` | Virtual users |
| `K6_DURATION` | `1m` | Steady load duration |

## Pass criteria (issue #425)

- p95 RPC latency **< 300 ms** on dev
- HTTP error rate **< 0.5%**
- Document headroom vs [FREE_TIER_LIMITS.md](../../../docs/SSOT/FREE_TIER_LIMITS.md)

Fill `REPORT.md` after each run (copy from `REPORT.template.md`).

## Index review

Before blaming app code, confirm hot paths:

```sql
-- expenses by group + created_at (dashboard / activity)
SELECT indexname FROM pg_indexes WHERE tablename = 'expenses';
```

Existing migration `202382` added performance indexes on dev; re-run `EXPLAIN (ANALYZE, BUFFERS)` in Supabase SQL editor if p95 fails.
