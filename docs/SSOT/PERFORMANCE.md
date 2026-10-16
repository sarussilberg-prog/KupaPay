# Performance — CI budgets & runtime monitoring

**Language:** English only.  
**Scope:** Database efficiency, client query counts, bundle size, and Sentry Performance tracing.

---

## CI checks (PRs to `dev`)

| Check | Workflow | What it enforces |
|--------|-----------|-------------------|
| Supabase SQL + DB lints + RPC EXPLAIN | [supabase-sql-integration.yml](../../.github/workflows/supabase-sql-integration.yml) | Splinter-style lints (baseline-gated), hot-path RPC timing / plan guards |
| Mobile Supabase budgets | [ci-performance.yml](../../.github/workflows/ci-performance.yml) | Mocked per-screen Supabase call counts |
| Bundle size | `ci-performance` → `scripts/ci-bundle-size.sh` | `size-limit` on Expo web export + Next.js chunks |
| Lighthouse (Next.js) | `ci-performance` job `lighthouse-next` | Local `next start` + LHCI; **performance score ≥ 0.85 required** |

No Vercel deploys are required for these jobs.

### Database lints

After migrations apply on the local Postgres 17 container (`scripts/ci-supabase-sql-tests.sh`):

1. **Unindexed foreign keys** (`public` schema)
2. **`auth_rls_initplan`** — `auth.uid()` / JWT helpers in RLS must use `(select auth.uid())` form
3. **RLS filter columns** — `user_id` / `group_id` / `created_by` referenced in policies should have an index

New violations fail CI (per lint type) when that type is **`enforce: true`** in [`cost-share-app/supabase/ci/db-lint-baseline.json`](../../cost-share-app/supabase/ci/db-lint-baseline.json) and the `cache_key` is not grandfathered. Today **unindexed foreign keys** are enforced; RLS initplan / policy-column index lints are reported as warnings until the baseline is seeded from a Docker SQL CI run, then flipped to enforced.

### RPC / SQL performance test

[`cost-share-app/supabase/__tests__/rpc_explain_performance.test.sql`](../../cost-share-app/supabase/__tests__/rpc_explain_performance.test.sql) seeds ~600 expenses and asserts:

| Path | Budget (local Docker) |
|------|------------------------|
| `get_user_simplified_inputs` | ≤ 800 ms |
| `get_user_groups_archive_state` | ≤ 400 ms |
| Groups list join query | ≤ 400 ms |
| Group expenses list query | ≤ 400 ms, no seq scan on `expenses` at scale |

### Mobile Supabase request budgets (mocked)

Defined in [`cost-share-app/apps/mobile/__tests__/performance/screenSupabaseBudget.test.ts`](../../cost-share-app/apps/mobile/__tests__/performance/screenSupabaseBudget.test.ts):

| Screen / flow | Max Supabase calls (initial) |
|---------------|------------------------------|
| Groups list core (simplified + unread + batched add-expense warm) | 4 |
| Group detail (expenses list) | 2 |
| Settings (admin flag refresh) | 2 |

**N+1 fix:** Groups list add-expense warm-up uses **two** queries for all groups (`prefetchAddExpensePrerequisitesBatched`), not `2×N` (Sentry COPAY-MOBILE-PROD-K).

### Bundle size budgets

Configured in [`cost-share-app/.size-limit.json`](../../cost-share-app/.size-limit.json) (gzip):

| Artifact | Limit |
|----------|--------|
| Expo web `index-*.js` | 2800 KB (measured ~1760 KB gzip, Oct 2026) |
| Next.js `main-app-*.js` | 180 KB (measured ~0.4 KB gzip for app shell chunk; limit guards regressions) |

Run locally: `cd cost-share-app && npm run size:ci`.

### Lighthouse

`scripts/ci-lighthouse-next.sh` serves the built Next app on `127.0.0.1:3000` and runs LHCI with **performance error** at 0.85 and accessibility warn at 0.9.

### Next.js caching

- Marketing routes use `export const revalidate = 300` on `[locale]/page.tsx`.
- `next.config.ts` sets `experimental.staleTimes` for router cache (dev/preview friendly, fewer origin hits on Vercel free tier).

### Edge function cold starts

- Keep Deno entrypoints thin: lazy-import heavy modules inside the handler, not at top level.
- Cron/dispatch functions share `_shared/` helpers; avoid pulling the full Supabase client into invite-landing-sized handlers.
- CI **Deno edge bundle** job (`ci-deno-check-edge-bundle.sh`) guards bundle size regressions that correlate with cold-start latency.

---

## Sentry Performance (runtime)

### Sample rates

| Environment | `tracesSampleRate` |
|-------------|-------------------|
| `production` | **0.2** |
| `development` / previews | **1.0** |

- **Mobile:** `EXPO_PUBLIC_SENTRY_ENVIRONMENT` + [`apps/mobile/lib/sentry.ts`](../../cost-share-app/apps/mobile/lib/sentry.ts)
- **Next.js site:** `NEXT_PUBLIC_SENTRY_ENVIRONMENT` + [`apps/web/instrumentation-client.ts`](../../cost-share-app/apps/web/instrumentation-client.ts)

Error `sampleRate` remains **1.0** (errors are not subsampled).

### What is traced

| Signal | Mobile | Web (Next) |
|--------|--------|------------|
| React Navigation screen loads | `reactNavigationIntegration` (`enableTimeToInitialDisplay: true`) | N/A (marketing site) |
| App cold start | `app.boot` span when JS init finishes ([`appBootPerformance.ts`](../../cost-share-app/apps/mobile/lib/appBootPerformance.ts)) | — |
| Native auto instrumentation | `reactNativeTracingIntegration` | — |
| Supabase HTTP | `supabase.http` spans via [`instrumentedFetch.ts`](../../cost-share-app/apps/mobile/lib/instrumentedFetch.ts) when DSN is set | — |

Span names look like `supabase.GET groups`, `supabase.POST rpc/get_user_simplified_inputs`.

### How to view in Sentry

1. Open the [KupaPay Sentry org](https://de.sentry.io/) (EU).
2. Select project **mobile (production/dev)** or **web** matching your DSN.
3. **Explore → Performance** (or **Traces** in newer UI).
4. Filter:
   - `environment:production` or `development`
   - `transaction.op:navigation` for screen loads
   - `transaction:` `app.boot` for startup
   - `span.op:supabase.http` for API latency
5. Open a trace to see waterfall: navigation → Supabase spans → child fetches.

For regressions, compare p95 of `app.boot` and hot `supabase.*` spans before/after a release (same `release` as `version.json` / EAS build).

---

## Related SSOT

- [CODE QUALITY.md](./CODE%20QUALITY.md) — architecture boundaries  
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — KI-014 (Jest worker), mobile service test gaps
