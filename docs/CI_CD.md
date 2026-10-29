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

- Per PR: `ci-<pr-number>` with **cancel-in-progress** so superseded pushes stop stale runs. A hung job (no step timeout) can hold this group and leave newer runs **pending with zero jobs** until the stuck run finishes or is cancelled — **Mobile tests** and **Coverage ratchet** use a **45-minute** job timeout; Jest runs with **`--forceExit`** in CI.
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

Job **`CI gate`** is the single pass/fail summary for branch protection.

Auto-merge to `dev` runs when **CI gate** and **Supabase migration guard** succeed and SonarCloud is green. If the PR is behind **`origin/dev`**, CI calls **`gh pr update-branch`** (merge commit) and re-runs checks instead of failing silently at merge time. If update-branch hits a transient GraphQL head-ref flake through all retries, auto-merge **defers** (CI stays green; the next run retries). If GitHub completes the squash merge before the **Auto-merge** job’s sync step (race with native auto-merge), sync treats **`MERGED`** as success, skips update-branch, and still runs the dev prerelease bump in the same job. The **Auto-merge** job enables **GitHub native squash auto-merge** (`gh pr merge --auto`). When GitHub completes that merge as **`github-actions[bot]`**, standalone `on: push` workflows on [`bump-dev-prerelease.yml`](../.github/workflows/bump-dev-prerelease.yml) do not run (that workflow is **`workflow_dispatch` only**). Instead, the **Auto-merge** job waits for the merge to finish, then runs **`bump-dev-prerelease.mjs`** in the same job (commits with **`[skip ci]`**, pushes with **`ADMIN_PAT`**). Standalone [`bump-dev-prerelease.yml`](../.github/workflows/bump-dev-prerelease.yml) is **`workflow_dispatch` only** (see [CI_ADMIN_PAT.md](SSOT/CI_ADMIN_PAT.md)).

### Branch protection proposal (GitHub UI — not applied by CI)

Apply manually under **Settings → Branches**. Use the **exact** check names GitHub shows on a green PR (copy from the checks dropdown).

#### `main` (release PRs — human merge)

| Required status check | Workflow / job |
|----------------------|----------------|
| **CI gate** | [`ci.yml`](../.github/workflows/ci.yml) aggregate |
| **Supabase migration guard** | [`ci.yml`](../.github/workflows/ci.yml) |
| **Secret scan (gitleaks)** | [`ci.yml`](../.github/workflows/ci.yml) |
| **SonarCloud Code Analysis** | SonarCloud (external) |

Recommended repo rules (not enforced in YAML): require **1 approving review**, **dismiss stale reviews**, **require conversation resolution**, **block force-push**, **require linear history optional**.

PRs to **`main`** always run the **full** CI matrix (no path skipping). Optional: enable **merge queue** on `main` with the same required checks.

#### `dev` (bot auto-merge)

| Required status check | Notes |
|----------------------|--------|
| **CI gate** | Path-scoped jobs roll up here |
| **Supabase migration guard** | Also polled before auto-merge |
| **Secret scan (gitleaks)** | Full-repo history scan |
| **PR hygiene (scope + title)** | [`pr-hygiene.yml`](../.github/workflows/pr-hygiene.yml) — `cursor/*` PRs only |
| **SonarCloud Code Analysis** | Waited on in **Auto-merge to dev** |

Individual job names (only if you prefer granular protection instead of **CI gate**): **CI path plan**, **Install dependencies**, **Lint**, **Typecheck**, **Mobile tests**, **Coverage ratchet**, **Legal locale parity**, **Deno edge gate**, **No merge conflict markers**, **Expo mobile config**, **CI performance**, **Supabase SQL integration**, **Deno edge bundle (all functions)**, **Branch up to date with dev**.

### Mobile device UI (Maestro)

When a PR touches mobile/shared paths, [`mobile-device-ui-maestro.yml`](../.github/workflows/mobile-device-ui-maestro.yml) runs **Mobile device UI (Maestro iOS)** on **`macos-latest`** (single **iPhone 16** simulator). It uses a **separate concurrency group** (`maestro-ui-<pr>`) and **`continue-on-error: true`** so macOS queue time or simulator flakes do **not** block **CI gate** or auto-merge. Android PR emulators were removed from PR CI for cost; use [`e2e-smoke.yml`](../.github/workflows/e2e-smoke.yml) / nightly flows for broader device coverage.

The Maestro job:

- Seed the dev E2E user (`npm run seed:e2e`) when `SUPABASE_SERVICE_ROLE_KEY_DEV` / `E2E_TEST_PASSWORD` secrets are set
- Build a release dev client with `EXPO_PUBLIC_E2E_MAESTRO_AUTH=true` (email/password panel on the login screen)
- Run flows under [`cost-share-app/apps/mobile/.maestro/device-ui/`](../cost-share-app/apps/mobile/.maestro/device-ui/) — groups list layout (en + he), seven-locale login string screenshots, and Hebrew RTL profile friend breakdown + settle confirm
- Upload PNG artifacts: **`maestro-device-ui-ios-<run_id>`** (retention 7 days)

**Not required for merge** — rely on **CI gate** (Jest + layout regression tests) for blocking checks. Optional: watch the Maestro workflow on the PR checks tab.

Secrets: `E2E_TEST_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY_DEV` (optional `E2E_TEST_EMAIL`).

#### Security & supply chain (both branches)

- **Secret scan (gitleaks)** — [`gitleaks/gitleaks-action`](https://github.com/gitleaks/gitleaks-action), config [`.gitleaks.toml`](../.gitleaks.toml)
- **npm audit** — `npm run audit:ci` inside **Install dependencies**

### Migration safety (incident prevention)

Duplicate `YYYYMMDDHHMMSS` prefixes broke staging when two PRs merged with the same version (CI only scanned each branch in isolation).

**Layers:**

1. **Filename lint** — [`supabase-lint-migration-filenames.sh`](../cost-share-app/scripts/supabase-lint-migration-filenames.sh)
2. **Migration chain** — [`supabase-migration-chain-check.sh`](../cost-share-app/scripts/supabase-migration-chain-check.sh): unique prefixes, strict order, new files newer than base branch max
3. **PR tree uniqueness** — [`supabase-unique-migration-versions.sh`](../cost-share-app/scripts/supabase-unique-migration-versions.sh)
4. **Merge simulation** — [`supabase-unique-migration-versions-at-merge.sh`](../cost-share-app/scripts/supabase-unique-migration-versions-at-merge.sh): latest **`origin/dev`** + **`origin/main`**, worktree merge, re-run lint + uniqueness
5. **Destructive SQL guard** — [`supabase-destructive-migration-check.sh`](../cost-share-app/scripts/supabase-destructive-migration-check.sh) (PR + staging deploy)
6. **Remote precheck** — [`supabase-remote-migration-precheck.sh`](../cost-share-app/scripts/supabase-remote-migration-precheck.sh) before `db push` ([#479](https://github.com/sarussilberg-prog/KupaPay/pull/479))
7. **Drift check** — [`supabase-migration-drift-check.sh`](../cost-share-app/scripts/supabase-migration-drift-check.sh): remote `schema_migrations` vs repo before deploy
8. **Deploy dry-run** — `workflow_dispatch` `dry_run` on [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml) / [`deploy-production.yml`](../.github/workflows/deploy-production.yml) sets `DRY_RUN=1` on [`supabase-ci-db-push.sh`](../cost-share-app/scripts/supabase-ci-db-push.sh)
9. **Schema contract** — [`ci-supabase-types-contract.sh`](../cost-share-app/scripts/ci-supabase-types-contract.sh) after SQL CI bootstrap (RPC/table surface vs snapshot)
10. **Pre-merge recheck** — auto-merge job before `gh pr merge`
11. **Branch freshness** — **Branch up to date with dev**
12. **Merge queue** — `merge_group` re-runs CI on queued commits

Reserved prefixes: [docs/SSOT/SUPABASE_MIGRATION_VERSIONS.md](SSOT/SUPABASE_MIGRATION_VERSIONS.md).

### Deno edge functions

Path-filtered matrix ([#140](https://github.com/sarussilberg-prog/KupaPay/issues/140)): [`ci-deno-matrix-plan.sh`](../cost-share-app/scripts/ci-deno-matrix-plan.sh). Job **Deno edge gate** validates skipped vs executed matrix.

### SQL regression + quarantine

[`.github/workflows/supabase-sql-integration.yml`](../.github/workflows/supabase-sql-integration.yml) — pinned Supabase CLI + Postgres image ([`ci-supabase-versions.env`](../cost-share-app/scripts/ci-supabase-versions.env)), cached Docker image, readiness wait for stable `auth` after Supabase image first-boot restart, bootstrap via [`ci-supabase-sql-bootstrap.sh`](../cost-share-app/scripts/ci-supabase-sql-bootstrap.sh) with **one retry on bootstrap only**, then [`ci-supabase-sql-run-tests.sh`](../cost-share-app/scripts/ci-supabase-sql-run-tests.sh) (no test retry). Local one-shot: [`ci-supabase-sql-tests.sh`](../cost-share-app/scripts/ci-supabase-sql-tests.sh).

Flaky SQL tests: quarantine manifest ([#138](https://github.com/sarussilberg-prog/KupaPay/issues/138)) — each `*.test.sql` runs or is quarantined with a tracking issue.

### Jest (mobile) + Playwright flaky handling ([#510](https://github.com/sarussilberg-prog/KupaPay/issues/510))

**Mobile unit tests (blocking CI gate):** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) job **Mobile tests** runs [`ci-jest-run-tests.sh`](../cost-share-app/scripts/ci-jest-run-tests.sh):

1. All Jest files **except** those in [`apps/mobile/__tests__/ci-quarantine.json`](../cost-share-app/apps/mobile/__tests__/ci-quarantine.json).
2. On failure, **one** `--onlyFailures` retry; tests that pass only on retry are reported as **flaky** (`::warning` + job summary + `jest-flaky-report` artifact).
3. Quarantined files run afterward **non-blocking** (failures are warnings; CI gate still passes).

Add a quarantine entry with `issue` + `reason` (path relative to `apps/mobile/`, e.g. `__tests__/foo.test.ts`). Optional `@quarantine` in a test title is for humans only — CI reads the manifest. **Coverage ratchet** skips quarantined paths and caps manifest size via [`ci-coverage-baseline.json`](../cost-share-app/scripts/ci-coverage-baseline.json) (`mobile_jest_tests.max_quarantined`).

**Playwright (on-demand / scheduled, not CI gate):** [`playwright.config.ts`](../cost-share-app/playwright.config.ts) sets `retries: 1` in CI and writes `playwright-report/results.json`. E2E workflows call [`ci-playwright-flaky-summary.sh`](../cost-share-app/scripts/ci-playwright-flaky-summary.sh) to list tests that passed on retry in the job summary.

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

**Vercel dashboard + project roots:** See [SSOT/VERCEL.md](SSOT/VERCEL.md).

**Vercel ignored build step (SSOT):** Do not maintain branch/path skip logic in the Vercel dashboard. Set **Ignored Build Step** to the same command as [`apps/web/vercel.json`](../cost-share-app/apps/web/vercel.json) `ignoreCommand` (project root = `cost-share-app/apps/web`):

```bash
bash scripts/vercel-should-build.sh web
```

Production (`kupa-pay` / marketing project): builds only when `VERCEL_GIT_COMMIT_REF=main`. Dev projects (`prj_ldRyqXhp9Gg0QAHCNzEBw3VIcWbc`, `prj_wa5noNsRFK5797IRthACeREIa8jR`): only `dev`. Exit **0** = skip, **1** = build.
| iOS + Android | [`mobile-staging-nightly.yml`](../.github/workflows/mobile-staging-nightly.yml) | **02:00 Asia/Jerusalem** — at most **one iOS + one Android** per day if mobile/shared changed since last successful build. Baseline is stored in the repo Actions variable **`MOBILE_CD_BASELINE`** (JSON); [`mobile-cd-baseline.json`](../cost-share-app/apps/mobile/mobile-cd-baseline.json) is a read-only fallback for local/plan when the variable is unset. Failed baseline updates do not fail the workflow. |
| iOS | [`testflight-ios.yml`](../.github/workflows/testflight-ios.yml) | Manual **workflow_dispatch**; TestFlight “What to Test” from [`CHANGELOG.md`](../CHANGELOG.md) since last build |
| Android | [`play-internal.yml`](../.github/workflows/play-internal.yml) | Manual **workflow_dispatch**; release notes in job summary since last Play internal build |

### Production (`main`)

| Step | Workflow |
|------|----------|
| Migrations | [`deploy-production.yml`](../.github/workflows/deploy-production.yml) — backward-compat check, then prod DB (manual dispatch supported) |
| Web | Vercel production project after migrations land |

No workflow submits for App Store review or Play production.

**Seeding `MOBILE_CD_BASELINE`:** after the first successful TestFlight or Play internal run, the workflow writes the variable automatically (uses `ADMIN_PAT` when `GITHUB_TOKEN` cannot patch repo variables). If a build succeeded but baseline commit failed historically, set the variable once with `gh api` (see `cost-share-app/apps/mobile/scripts/mobile-cd-baseline-lib.sh` JSON shape) using the `dev` commit SHA that was built.

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
