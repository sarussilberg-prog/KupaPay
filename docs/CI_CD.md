# KupaPay CI/CD

Single reference for how code moves from PR → **dev** (staging) → **main** (production). GitHub Actions live under [`.github/workflows/`](../.github/workflows/).

## Branching and environments

| Branch | Supabase project | Web (Vercel) | Mobile |
|--------|------------------|--------------|--------|
| `dev` | Development (`drxfbicunusmipdgbgdk`) | Preview / staging projects | TestFlight + Play **internal** |
| `main` | Production (`jfqxjjjbpxbwwvoygahu`) | Production | Manual release only (no auto App Store / Play production) |

Flow: feature PR → **`dev`** (auto-merge when green) → release PR → **`main`** (human merge; no agent auto-merge to `main`).

See also [docs/SSOT/SUPABASE_ENVIRONMENTS.md](SSOT/SUPABASE_ENVIRONMENTS.md).

## Continuous integration (PRs)

**Workflow:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)  
**Triggers:** `pull_request` to `dev`, `main`, or `cursor/**`; **`merge_group`** on `dev` when GitHub merge queue is enabled.

### Concurrency

- Per PR: `ci-<pr-number>` with **cancel-in-progress** so superseded pushes stop stale runs.
- Auto-merge + dev version bump: `dev-merge-and-bump` (no cancel) to avoid `version.json` races.

### Path-scoped jobs (speed)

[`cost-share-app/scripts/ci-paths-plan.sh`](../cost-share-app/scripts/ci-paths-plan.sh) decides which areas run:

| Area | Paths (under repo root) | Jobs |
|------|-------------------------|------|
| Mobile | `cost-share-app/apps/mobile/**`, shared package | Lint, typecheck, mobile tests, legal locale, Expo config |
| Web | `cost-share-app/apps/web/**`, shared | Lint, typecheck |
| Supabase | `migrations/`, `__tests__/`, `schema.sql`, supabase scripts | SQL integration (Docker) |
| Edge | `supabase/functions/**`, `ci-deno-*` | Deno matrix + bundle check |
| Docs only | `docs/**`, `*.md` only | Skips npm install; **CI gate** still required |
| Monorepo / CI | `package.json`, lockfile, `turbo.json`, `.github/**` | Full suite |

PRs targeting **`main`** always run the **full** suite (no path skipping).

### Required aggregate check

Job **`CI gate`** is the single pass/fail summary for branch protection. Recommended required checks:

- **CI gate**
- **Supabase migration guard**
- **SonarCloud Code Analysis** (polled before auto-merge)
- Or keep individual job names if branch protection already lists them.

Auto-merge to `dev` runs when **CI gate** and **Supabase migration guard** succeed, SonarCloud is green, and the branch is **up to date with `origin/dev`**.

### Migration safety (incident prevention)

Duplicate `YYYYMMDDHHMMSS` prefixes broke staging when two PRs merged with the same version (CI only scanned each branch in isolation).

**Layers:**

1. **Filename lint** — [`supabase-lint-migration-filenames.sh`](../cost-share-app/scripts/supabase-lint-migration-filenames.sh)
2. **PR tree uniqueness** — [`supabase-unique-migration-versions.sh`](../cost-share-app/scripts/supabase-unique-migration-versions.sh)
3. **Merge simulation** — [`supabase-unique-migration-versions-at-merge.sh`](../cost-share-app/scripts/supabase-unique-migration-versions-at-merge.sh): latest **`origin/dev`** + **`origin/main`**, worktree merge, re-run lint + uniqueness
4. **Pre-merge recheck** — auto-merge job before `gh pr merge`
5. **Branch freshness** — **Branch up to date with dev**
6. **Merge queue** — `merge_group` re-runs CI on queued commits

Reserved prefixes: [docs/SSOT/SUPABASE_MIGRATION_VERSIONS.md](SSOT/SUPABASE_MIGRATION_VERSIONS.md).

### Deno edge functions

Path-filtered matrix ([#140](https://github.com/sarussilberg-prog/KupaPay/issues/140)): [`ci-deno-matrix-plan.sh`](../cost-share-app/scripts/ci-deno-matrix-plan.sh). Job **Deno edge gate** validates skipped vs executed matrix.

### SQL regression + quarantine

[`.github/workflows/supabase-sql-integration.yml`](../.github/workflows/supabase-sql-integration.yml) — pinned Supabase CLI + Postgres image ([`ci-supabase-versions.env`](../cost-share-app/scripts/ci-supabase-versions.env)), cached Docker image, readiness wait for stable `auth` after Supabase image first-boot restart, bootstrap via [`ci-supabase-sql-bootstrap.sh`](../cost-share-app/scripts/ci-supabase-sql-bootstrap.sh) with **one retry on bootstrap only**, then [`ci-supabase-sql-run-tests.sh`](../cost-share-app/scripts/ci-supabase-sql-run-tests.sh) (no test retry). Local one-shot: [`ci-supabase-sql-tests.sh`](../cost-share-app/scripts/ci-supabase-sql-tests.sh).

Flaky SQL tests: quarantine manifest ([#138](https://github.com/sarussilberg-prog/KupaPay/issues/138)) — each `*.test.sql` runs or is quarantined with a tracking issue.

### Performance / budgets

[`.github/workflows/ci-performance.yml`](../.github/workflows/ci-performance.yml) — path-filtered when mobile/web change.

### Caches

- **npm** — `actions/setup-node` on lockfile
- **Turbo** — `cost-share-app/.turbo`
- **Expo** — `apps/mobile/.expo`, `~/.expo`

### Failure notifications

[`.github/workflows/ci-notify.yml`](../.github/workflows/ci-notify.yml) comments on the PR when **CI** fails.

### Auto-merge to `dev`

Squash merge via `gh pr merge --auto` after checks + SonarCloud, then dev prerelease bump with `[skip ci]`. See [APP_VERSION.md](SSOT/APP_VERSION.md).

## Continuous delivery

### Staging (`dev` push)

| Component | Workflow | Behavior |
|-----------|----------|----------|
| Supabase | [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml) | Migrations → development DB + smoke |
| Web | Vercel | [`vercel-should-build.sh`](../cost-share-app/apps/web/scripts/vercel-should-build.sh) — path-based skip; dev vs prod by project ID |
| iOS + Android | [`mobile-staging-nightly.yml`](../.github/workflows/mobile-staging-nightly.yml) | **02:00 Asia/Jerusalem** — at most **one iOS + one Android** per day if mobile/shared changed since last successful build ([`mobile-cd-baseline.json`](../cost-share-app/apps/mobile/mobile-cd-baseline.json)) |
| iOS | [`testflight-ios.yml`](../.github/workflows/testflight-ios.yml) | Manual **workflow_dispatch**; TestFlight “What to Test” from [`CHANGELOG.md`](../CHANGELOG.md) since last build |
| Android | [`play-internal.yml`](../.github/workflows/play-internal.yml) | Manual **workflow_dispatch**; release notes in job summary since last Play internal build |

### Production (`main`)

| Step | Workflow |
|------|----------|
| Migrations | [`deploy-production.yml`](../.github/workflows/deploy-production.yml) — backward-compat check, then prod DB (manual dispatch supported) |
| Web | Vercel production project after migrations land |

No workflow submits for App Store review or Play production.

## CI duration (before / after)

| Scenario | Before (approx.) | After (measured / expected) |
|----------|------------------|-----------------------------|
| Full PR (CI + SQL + Deno + npm) | **6m51s** (run 38924231905, 2026-10-16) | **5m54s** (run 38927165712, same day) |
| Docs / markdown only | ~6–7 min (full suite) | **~1–2 min** (migration guard + gate only) |
| Edge-only (expected) | Full npm + all Deno | **~2–4 min** (npm skipped) |

Wall time = workflow `createdAt` → `updatedAt` on GitHub Actions. SonarCloud is parallel and not included.

## Related docs

- [CI_ADMIN_PAT.md](SSOT/CI_ADMIN_PAT.md)
- [PERFORMANCE.md](SSOT/PERFORMANCE.md)
- [TESTFLIGHT_GITHUB_ACTIONS.md](TESTFLIGHT_GITHUB_ACTIONS.md) / [PLAY_INTERNAL_GITHUB_ACTIONS.md](PLAY_INTERNAL_GITHUB_ACTIONS.md)

## In-flight coordination

| Item | This PR |
|------|---------|
| [#140](https://github.com/sarussilberg-prog/KupaPay/issues/140) Deno matrix | Included — close duplicate #389 when merged |
| [#138](https://github.com/sarussilberg-prog/KupaPay/issues/138) SQL quarantine | Not duplicated |
| [#141](https://github.com/sarussilberg-prog/KupaPay/issues/141) RevenueCat tests | Not duplicated |
