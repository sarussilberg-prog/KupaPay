# Load test — dev Supabase RPCs (#425)

Uses [k6](https://k6.io/) (open source, free). Targets **development** only (`drxfbicunusmipdgbgdk`).

Hot path RPCs are defined in [`load-test-manifest.json`](./load-test-manifest.json) (groups list: simplified debts, archive state, activity unread). Legacy `get_user_dashboard` was removed in migration `20261016161100` — do not load-test it.

## Prerequisites

```bash
brew install k6   # macOS / Linux
```

## Run (password auth helper)

```bash
cd cost-share-app/scripts/load-test
export SUPABASE_URL="https://drxfbicunusmipdgbgdk.supabase.co"
export SUPABASE_ANON_KEY="<dev anon key>"
export LOAD_TEST_PASSWORD="<dev test user password>"
# optional: LOAD_TEST_EMAIL (default e2e-playwright@kupay-dev.test)
eval "$(node prepare-k6-env.mjs)"
k6 run k6-dev-rpcs.js
```

Or export `K6_USER_JWT` / `K6_USER_ID` manually after sign-in.

Optional tuning:

| Env | Default | Purpose |
|-----|---------|---------|
| `K6_VUS` | `15` | Virtual users (~10× naive concurrent peak @ 1000 MAU) |
| `K6_DURATION` | `1m` | Steady load duration |

## Pass criteria (issue #425)

- p95 RPC latency **< 300 ms** on dev (k6 thresholds)
- HTTP error rate **< 0.5%**
- Index review: [INDEX_REVIEW.md](./INDEX_REVIEW.md)
- Free-tier headroom: [HEADROOM.md](./HEADROOM.md) + [FREE_TIER_LIMITS.md](../../../docs/SSOT/FREE_TIER_LIMITS.md)

Update [REPORT.md](./REPORT.md) after each authenticated k6 run. CI validates the manifest via `npm run test:load-test`.

## GitHub Actions

Workflow [`.github/workflows/load-test-dev-manual.yml`](../../../.github/workflows/load-test-dev-manual.yml) accepts `LOAD_TEST_*` secrets or falls back to `E2E_*` credentials.

## Local unit tests (no k6 / no network)

```bash
cd cost-share-app && npm run test:load-test
```
