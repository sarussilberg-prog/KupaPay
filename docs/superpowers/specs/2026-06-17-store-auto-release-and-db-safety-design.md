# KupaPay — Store Auto-Release (OTA-first) + DB Safety for Non-Updating Users

**Status:** Approved design — pending user review before implementation planning
**Date:** 2026-06-17
**Monorepo root:** `cost-share-app/`
**Mobile app:** `cost-share-app/apps/mobile` (Expo SDK 54, `expo-updates ~29.0.18`, RN 0.81)
**Extends (does not replace):** [`2026-05-19-kupa-cicd-design.md`](2026-05-19-kupa-cicd-design.md), which established branching, CI gates, and staging/prod CD but **explicitly listed store auto-submit and OTA-on-merge as non-goals** ("Store release: Manual `eas submit`"). This spec picks up exactly that deferred scope; the prior spec's web/Vercel/branch-protection decisions still stand.

---

## 1. Problem & Goals

The user wants every merge to `main` to update the app in the Apple App Store and Google Play **automatically**, **without breaking the database for users who do not update the app**.

### Goals

1. **Automatic delivery on merge to `main`** — JS/asset changes reach users fast via EAS Update (OTA); native changes auto-route to a full store build + submit.
2. **Never break non-updating users** — two independent safety layers (a forced-update gate in the app + a CI migration-safety gate) plus an enforced expand/contract migration discipline.
3. **Hands-off up to the one irreversible step** — native binaries auto-build and auto-submit to the production track; a human clicks the final "release" (per user decision).
4. **No false greens** — safety gates must fail closed; a misrouted OTA must not be able to brick an incompatible binary.

### Non-goals (this phase)

- Web app CD (already handled via Vercel Git per the prior spec).
- API/server deploy (no `apps/server` exists in the current tree; the prior spec's NestJS surface is stale).
- Fully automatic *release* (auto-publish to 100% of users) for native builds — explicitly rejected by the user in favor of a manual final release.
- Replacing the existing version-bump / migration workflows wholesale — they are reconciled, not deleted.

---

## 2. Decisions (confirmed with user)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Release model | **OTA-first.** EAS Update on every merge for JS-only; full store build only on native change. |
| D2 | OTA-vs-native routing | **Hybrid, fully automatic by default**, with manual override both directions. Routing is driven by the EAS **fingerprint** runtime, not a hand-rolled path classifier. |
| D3 | DB safety scope | **Both layers** — forced-update gate **and** CI migration gate. Hard-block below min version. |
| D4 | Native build post-build behavior | **Auto-submit to production track on both stores; manual final release.** |
| D5 | Final app identifiers (frozen now, while user base ≈ 0) | bundleId/package **`com.kupapay.mobile`**, Apple team **`HVW3H3DLRB`**, EAS **`@saussilberg/kupapay`**. |
| D6 | Build order | **OTA-first is the target, but built in the dependency-forced sequence** (M0→M4 below). OTA can physically reach no one until an update-capable binary is shipped and adopted, so the store path and DB-safety land first. |

---

## 3. Current state (verified, 2026-06-17)

These facts shaped the design; several contradict the naive plan and are why the sequence matters.

- **EAS Update is not wired.** `expo-updates` is installed but inert: no `updates.url`, `extra.eas` is `{}` (no `projectId`), no `channel` on any build profile in `eas.json`. **Every currently-installed build is "deaf" to OTA** — it will receive nothing until a new update-capable binary ships.
- **`runtimeVersion.policy: "appVersion"`** ties each JS bundle to the app version → incompatible with OTA-first as-is.
- **Versioning is decorative.** There is no `app.config.js/ts`; `app.json` is static (`version: "1.0.0"`, `ios.buildNumber: "4"`). `version.json` is imported only by `screens/auth/LoginScreen.tsx` for display and feeds neither the native version nor EAS. The bump-version workflows mutate a file nothing reads.
- **iOS submit cannot run headless.** `eas.json` `submit.production.ios` has only `appleId` → interactive 2FA. Needs an App Store Connect API key.
- **Android submit targets the wrong audience.** `submit.production.android` is `track: internal`, `releaseStatus: draft` → "auto-update Google Play" currently ships a draft to internal testers, not production.
- **`packageManager: yarn@1.22.22`** in `cost-share-app/package.json` while CI uses `npm ci` + `package-lock.json` → Corepack will try yarn on EAS cloud builds. (The prior spec already flagged this for removal in Phase 0; still pending.)
- **Identifiers are mid-rebrand and internally inconsistent:** repo has `com.copay.mobile`, slug `copay`, Apple team `K3M6R85KA6`, and `scheme: "com.copay.mobile"` (the deep-link scheme — a native value). Final identity is D5.
- **Prod migrations auto-apply on `main` push** (`deploy-production.yml`) with no human gate beyond the dev→main PR; the push is **one-way** (`supabase-ci-db-push.sh` only reconciles remote-only history forward) and **prod has silently desynced once** (`20260610120000_reconcile_prod_drift.sql`). Migrations are required to be idempotent.
- `supabase/__tests__/*.test.sql` exists (4 files) — a foundation for contract testing.
- Three workflows already fire on `main` push with independent concurrency groups (`bump-version-main`, `deploy-production`, and via the auto-merge, more). `bump-version-main.yml` opens + squash-merges a PR → a **second push to main**.
- Pushes made with the default `GITHUB_TOKEN` do **not** trigger new workflow runs — so a naive `on: push: main` trigger may never fire for bot-merged commits, and conversely avoids the bump-loop.

---

## 4. Architecture — milestone sequence

Each milestone is independently valuable and shippable even if later ones never happen.

### M0 — Freeze & reconcile identifiers *(hard precondition; nothing auto-submits before this)*

- Set across `app.json` (and the future `app.config.ts`): `ios.bundleIdentifier` + `android.package` = `com.kupapay.mobile`; `ios.appleTeamId` = `HVW3H3DLRB`; `owner` = `saussilberg`; `slug` = `kupapay`; `extra.eas.projectId` = the `@saussilberg/kupapay` project id (memory: `e4a625dc…` — **verify against `eas project:info` before writing**).
- Decide and set the deep-link `scheme` (recommend a clean `kupapay` rather than a reverse-DNS string; changing it is a native change and must be done now). `associatedDomains: applinks:kupa.pro` and the Android `kupa.pro` intent filters are domain-based and unaffected.
- Confirm the EAS project, Apple app record, and Play app record all exist under the final identifiers. Because user base ≈ 0, the bundleId switch is done **once, now**, and never again.

### M1 — Versioning & runtime foundation

- **Single version source.** Convert `app.json` → `app.config.ts` that reads `version` from `version.json`. Keep `cli.appVersionSource: "remote"` + `autoIncrement` for `buildNumber`/`versionCode` only. Result: `version.json` becomes the real human-facing version; build numbers are EAS-managed; the three sources collapse to one.
- **Switch `runtimeVersion.policy` → `fingerprint`.** This makes OTA applicability native-aware: JS-only change keeps the fingerprint (OTA applies), native change flips it (OTA won't apply to old builds → forces a store build). This is the **safety backstop**: a misrouted OTA can't reach an incompatible runtime.
- **Pin fingerprint inputs** for the monorepo: configure `fingerprint.sources` / `.fingerprintignore` so the hash is computed from `apps/mobile` (native dirs, native deps, config plugins incl. `./plugins/withFastStackTransitions` and the `copay-partial-auth-browser` module) and is **not** perturbed by unrelated monorepo-root lockfile churn.
- **Remove `packageManager: yarn`** from `cost-share-app/package.json`; ensure EAS cloud build uses npm + `package-lock.json`.
- **Cutover note:** existing `appVersion`-policy installs (and all current installs, which lack an updates URL entirely) will not receive OTA. OTA delivery begins only after the first `fingerprint` + updates-URL build ships and is adopted.

### M2 — DB safety (the core of "don't break non-updating users")

**Layer A — CI migration-safety gate (replaces the naive grep-as-gate):**

- **Primary gate = migration replay + released-client contract test.** A CI job spins up a fresh Postgres, applies **all** migrations in order, then runs `supabase/__tests__/*.test.sql` plus a **contract snapshot** of the surface old clients depend on: column sets of key views and **return shapes / signatures of RPCs** (e.g. `get_user_dashboard`, `optimize_get_user_dashboard`, `get_group_pairwise_debts`). A change that drops a column from a view or alters an RPC's shape **fails the build** — exactly the breakage a regex cannot see.
- **Secondary, advisory only = dangerous-pattern scan.** Grep new migration SQL for `DROP COLUMN/TABLE`, `RENAME`, `ALTER … DROP`, `ADD COLUMN … NOT NULL` without `DEFAULT`, `DROP FUNCTION`. Emits a warning / requires an explicit acknowledgement label; it is **not** the source of truth (it both misses real breakages and flags safe ones).
- **Placement:** runs on PRs to `dev` **and** on the `dev → main` PR (the prior spec's `ci-pr-main` slot). The current `ci.yml` only triggers on `pull_request: [dev]`, so a main-bound guard must be added explicitly or it never runs on the PR that actually reaches prod.

**Layer B — Forced-update gate in the app:**

- **Table `app_min_version`** (in a migration): columns `platform` (`ios`|`android`), `min_supported_version` (semver text), `recommended_version` (semver text, for a future soft nudge), `update_message` (text), `gate_enabled` (boolean, default true — a remote **kill-switch**), `updated_at`. RLS: public read (anon) of this table only; writes restricted to service role / admin.
- **App gate component** wrapping the app in `App.tsx`, before main navigation. On launch: fetch the row for the current platform; compare `min_supported_version` (semver) against `Application.nativeApplicationVersion`. If `gate_enabled` and installed `< min` → **hard-block** "update required" screen with a store deep link. Otherwise render the app.
- **Failure semantics (must be explicit):**
  - Fetch success → apply result; **cache** the value as last-known-good.
  - Fetch failure **with** cache → use cached value (fail to last-known-good).
  - Fetch failure **without** cache (cold start / first launch offline) → **allow** (fail-open).
  - `gate_enabled = false` → never block (kill-switch).
- **Setting the min is deliberate & validated.** A helper script (and/or admin action) raises `min_supported_version` only when shipping a breaking change. It **rejects** values that are not valid semver, exceed the latest *released* store version, or jump more than one minor — a typo here is a total-outage risk.
- **Known limitations (documented, not solved here):** the gate only protects app versions that already contain the gate code; the **web app** hits the same Supabase and can never be force-updated; and iOS/Android review on different timelines means "the released app" is two moving targets — `min_supported_version` is therefore **per-platform**.

**Sequencing & blast-radius controls:**

- **Ordered, fail-closed pipeline on `main`:** prod migration job runs first; the release/OTA job `needs:` it and is **skipped if the migration fails**. OTA is **never** published before its migration has succeeded. (Reverse failure — OTA published, migration failed — is structurally prevented by ordering.)
- **Prod migrations behind a protected GitHub Environment** (`Production`) with a **required reviewer**. Given the one-way push and the prior desync, unattended auto-apply to a financial DB is not acceptable; this adds one cheap human gate. The store-submit job joins the **same** environment so both money-paths share that gate.
- **The expand/contract operational rule (the load-bearing discipline):**
  > Every migration merged to `main` MUST be backward-compatible with the **currently-released store app on both platforms**. A breaking ("contract") migration may merge **only after** the new app version is live in both stores **and** `min_supported_version` has been raised to it.

### M3 — Automated store build + submit (the "auto-deploy" the user asked for)

- **Trigger (must be reliable, not incidental).** Do **not** rely on a bare `on: push: main` — bot-merged commits via `GITHUB_TOKEN` won't trigger it, and three workflows already race on `main`. **Chosen approach:** the release pipeline triggers on a **published GitHub Release / `release-*` tag** (created deliberately at the end of a main merge, or via `workflow_dispatch`), giving one unambiguous "ship this" signal. *(Open item O1: confirm the exact trigger wiring against the existing bump/auto-merge flow during planning.)*
- **One ordered workflow** (e.g. `release-main.yml`) with `concurrency: { group: release-${{ ref }}, cancel-in-progress: false }` so a build→submit sequence is never cancelled mid-flight. Jobs:
  1. `migrate-prod` (protected env, required reviewer) — applies pending prod migrations.
  2. `fingerprint-detect` — compute the current fingerprint; compare to the last shipped build's stored fingerprint via EAS. Classify `ota` vs `native`. Manual override via `workflow_dispatch` input (`force: ota|native`) and/or PR label.
  3. `build-native` *(native path)* — `eas build -p all --profile production --non-interactive`. The **first** such build is the fingerprint + updates-URL **cutover** binary.
  4. `submit-stores` *(native path)* — `eas submit -p all --profile production` to the **production** track (fix `eas.json`: Android `track: production`; iOS via ASC API key). `releaseStatus: draft` (Android) + manual iOS release = the **manual final release** (D4). Staged rollout supported.
  5. `publish-ota` *(ota path)* — `eas update --branch production --non-interactive`, gated on `migrate-prod` success.
  6. `notify` — `if: failure()` Slack/email via `SLACK_WEBHOOK_URL` on the ship jobs.
- **Credentials, least privilege:** prefer **EAS-managed** Apple Distribution cert + ASC API key + Google service-account (smaller blast radius than CI-held keys). CI holds only a robot-account `EXPO_TOKEN` scoped to the one project. Any key written to the runner goes to a temp file, never the workspace, never logs.
- **Apple policy guardrail (3.3.1 / 2.5.2):** OTA is for **fixes / minor changes**; significant new features go through a **reviewed native build**. Documented as policy; native/UI-bearing changes already route to a build via fingerprint.

### M4 — Activate OTA-on-merge

Once a cutover build (M3) is live in both stores and adopted: enable the `publish-ota` path as the default for JS-only merges. Native changes (fingerprint flip) continue to auto-route to a build. This is the final "always-updated" experience — reached only now, because earlier it would deliver to no one.

---

## 5. Secrets & prerequisites

| Secret / setting | Purpose | Notes |
|------------------|---------|-------|
| `EXPO_TOKEN` | EAS build/submit/update in CI | Robot account, scoped to `@saussilberg/kupapay` only |
| `extra.eas.projectId` | EAS project link | Set in M0; verify via `eas project:info` |
| `updates.url` + `channel: production` | EAS Update wiring | Written by `eas update:configure`; `channel` in `eas.json` production profile (and `staging` for `dev` per prior spec) |
| ASC API key (`.p8`, key id, issuer id, `ascAppId`) | Non-interactive iOS submit | Prefer EAS-managed credentials |
| Google service-account JSON | Non-interactive Android submit | Secret → temp file in CI, or EAS-managed; never committed |
| `SUPABASE_PROD_DB_PASSWORD` (exists) | Prod migrations | Already configured |
| `SLACK_WEBHOOK_URL` | Failure notifications | New |
| GitHub Environment `Production` | Human gate on prod migrate + store submit | Add required reviewer |

---

## 6. Rollback runbooks (each path is a different muscle)

- **Bad OTA (JS):** `eas update:rollback --branch production` (or re-publish the last-good update group) — clients recover on next launch within minutes. *Only works because the cutover build embedded the updates URL.*
- **Bad native build:** you cannot unship a binary. Halt the phased rollout in App Store Connect / Play Console; ship a fixed build (or OTA a JS-level mitigation if the bug is in JS). The manual-release gate (D4) is the primary defense.
- **Bad prod migration:** no automated down-path. Mitigations: take a pre-migration PITR checkpoint / `pg_dump` snapshot before `migrate-prod`; recover via documented forward-fix SQL. The expand/contract rule + required-reviewer gate exist to prevent ever needing this.

---

## 7. Risks & mitigations (from council review, 2026-06-17)

| Risk | Severity | Mitigation |
|------|----------|------------|
| OTA reaches nobody (deaf installs, appVersion policy) | Critical | M1 fingerprint + updates URL; explicit cutover build before M4 |
| iOS submit hangs in CI (appleId only) | Critical | ASC API key (M3) |
| Versioning decorative → gate has nothing to compare | Critical | M1 single version source via `app.config.ts` |
| OTA/migration unordered race over one-way prod push | Critical | M2 ordered fail-closed pipeline + required reviewer |
| Grep guard = false confidence | High | M2 replay + contract test as the real gate |
| Trigger never fires / triple-fires on `main` | High | M3 release-tag trigger + concurrency + O1 verification |
| Android ships draft to internal, not prod | High | M3 `track: production` |
| `packageManager: yarn` breaks first cloud build | High | M1 removal |
| Fingerprint instability in monorepo → spurious builds | High | M1 pinned `fingerprint.sources` |
| Min-version misconfig locks out 100% | High | M2 validation + `gate_enabled` kill-switch + cached fail-open |
| Identifier flip after wiring submit retargets a new app | Critical | M0 freeze before any submit wiring |
| Apple 3.3.1 exposure from OTA feature-shipping | Medium | M3 policy: OTA = fixes; features = reviewed build |
| Web app + pre-gate versions bypass gate | Medium | Documented; expand/contract covers them |

---

## 8. Open items to resolve during planning

- **O1 — Release trigger wiring.** Confirm exactly how `release-main.yml` is triggered so it fires **once** per intended release and interleaves correctly with `bump-version-main.yml` and `deploy-production.yml` (the `GITHUB_TOKEN`-no-retrigger and 3-way-race facts). Candidate: published GitHub Release / `release-*` tag.
- **O2 — EAS project id** value (verify `e4a625dc…` against `eas project:info`).
- **O3 — Final deep-link `scheme`** value (recommend `kupapay`).
- **O4 — Contract-snapshot mechanism** for views/RPCs (how to capture and diff the released-client surface in CI).
- **O5 — Whether `deploy-production.yml`'s migration step folds into the new ordered `release-main.yml`** or stays separate and is `needs:`-chained.

---

## 9. Success criteria

- A JS-only merge results in an OTA that reaches fingerprint-built installs within minutes — **after** its prod migration has succeeded, never before.
- A native change auto-builds and auto-submits both stores to the production track, stopping at a single manual "release" click.
- A migration that drops/renames a view column or changes an RPC shape **fails CI** before reaching `main`.
- Setting an invalid or too-high `min_supported_version` is rejected; a valid raise hard-blocks only sub-min installs; the kill-switch disables the gate without an app release.
- No prod migration applies without passing the required-reviewer environment gate.
- The first store build under the final `com.kupapay.mobile` identity is update-capable (fingerprint + updates URL), establishing the cutover.

---

## 10. References

- [`2026-05-19-kupa-cicd-design.md`](2026-05-19-kupa-cicd-design.md) — foundational CI/CD (this spec extends its deferred store/OTA scope)
- Council review, 2026-06-17 — 4 independent expert reviews (EAS/release, DB/migration safety, CI-CD/secrets, red-team/product risk)
- `cost-share-app/apps/mobile/{app.json,eas.json,version.json}`, `cost-share-app/scripts/supabase-ci-db-push.sh`, `.github/workflows/*`
