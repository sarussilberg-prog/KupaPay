# Free-tier headroom @ 1000 MAU (#425)

Static estimate from [`mauHeadroom.mjs`](./mauHeadroom.mjs). Update inputs in [`load-test-manifest.json`](./load-test-manifest.json) if product telemetry changes.

## Assumptions

| Input | Value | Source |
|-------|-------|--------|
| MAU | 1000 | MAU epic |
| Sessions / user / month | 20 | Conservative mobile engagement |
| Hot RPCs / groups-list open | 3 | k6 manifest |
| Extra RPC+REST / session | +4 | Settings, pro status, batched table reads |
| Avg JSON round-trip | 8 KB × 2 (req+resp) | Rough REST payload |

## Monthly volume (1000 MAU)

| Metric | Estimate | Free-tier cap | Utilization |
|--------|----------|---------------|-------------|
| Supabase REST-ish calls | ~140k | 2M edge invocations (proxy cap) | ~7% |
| Supabase egress (REST only) | ~2.1 GB | 5 GB | ~42% |
| PostHog `app_open` (1 / session) | 20k | 1M events | ~2% |
| Vercel marketing bandwidth | dominated by assets, not RPC | 100 GB | monitor in dashboard |

**Verdict:** At 1000 MAU with current call patterns, Supabase and PostHog free tiers have **comfortable headroom** (>30% margin) except egress, which should stay **below 70%** via caching and avoiding large list payloads. See [FREE_TIER_LIMITS.md](../../../docs/SSOT/FREE_TIER_LIMITS.md).

## k6 concurrency vs MAU

Default `K6_VUS=15` simulates ~15 concurrent authenticated clients hammering the groups-list RPC trio — roughly **10×** a naive single-digit concurrent peak at 1000 MAU. Passing k6 thresholds on dev is a deliberate stress bias, not average load.
