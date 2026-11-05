# KupaPay Mobile UI Quality & Testing Plan

Owner: KupaPay CTO agent. Approver: Nave. Status: approved strategy, implementation plan. Date: 2026-11-02.
Scope: `cost-share-app/apps/mobile` (Expo, RN 0.81 new architecture/Fabric), 7 locales incl. Hebrew RTL, iOS and Android.

## 1. Why this plan exists
The Groups screen broke in Hebrew on a real iPhone even though the fixes "passed". They were checked only in Jest and on the web. Neither runs Yoga/Fabric native layout. Nested `row-reverse` plus a hardcoded `direction:'ltr'` inside an RTL root collapses rows on device. Jest measured the card row at 306 in English and 120 in Hebrew, and the simulator pipeline never got to the Groups screen. **Rule from now on: a layout claim is only valid if it was measured on a native simulator/emulator.**

## 2. Goals / Non-goals
| Goals | Non-goals |
|---|---|
| Catch line wraps, collapsed rows and RTL mirroring bugs before a build reaches Nave | New features (frozen until stable) |
| One RTL-safe row primitive, with the old patterns banned by a guard | Redesigning screens autonomously |
| Deterministic, AI-free checks on simulator/emulator | AI or visual-judgement models in tests |
| Catch release-only launch crashes; halt bad rollouts automatically | Device-cloud runs on every PR |
| Stay within budget: ≤2 cloud agents, bounded CI minutes | 100% screenshot coverage |

## 3. Test pyramid: what each layer may claim
| Layer | Runs where / when | MAY claim | MAY NOT claim |
|---|---|---|---|
| Jest + RNTL (unit, guards) | every PR | logic, i18n keys exist, `orderedRoutes(isRtl)` order, guard bans, props/testIDs | anything about pixel layout, line wraps, native crashes |
| Simulator numeric probes (Maestro + `lib/e2eLayoutProbes.ts`) | dev: smoke + changed screens; main: full | measured frame widths/x-order and `onTextLayout` line counts per locale/device | "looks good" aesthetically |
| Simulator screenshot diff (Maestro `assertScreenshot`) | same as above, key screens only | "matches the Nave-approved baseline within threshold" | correctness of a screen without a baseline |
| Release-build launch smoke | main + before store submit | the Release binary (dev mode off) launches and renders the first screen without a crash | full functionality |
| AWS Device Farm (real devices) | only before a store release | it boots and runs the smoke flow on real hardware | anything not in the flow |
| Production (Sentry, Play staged rollout) | after release | crash-free rate, regression halting | — |

Simulator suites gate **production store releases**. On dev they are informative (smoke plus changed screens), except that a PR claiming to fix a layout bug must include green simulator proof (§7).

## 4. Phases (strict order: a phase starts only after the previous one meets its acceptance criteria)

### Phase 0: Simulator pipeline produces real measurements end to end (finish draft PR #695)
- **Deliverables:** the CI Release sim build is pointed at **dev Supabase** (drxfbicunusmipdgbgdk) through build-time env in a dedicated `e2e` build profile/env, never prod. The sign-in flow goes through onboarding and the real email login with the dev test user (credentials from GitHub secrets, never printed). The test-only email form and layout probes are enabled **only** when `EXPO_PUBLIC_E2E=1` (or an equivalent flag), because the earlier user-visible changes on #695 have to be reverted. The artifact is a JSON of measured frames for he/en.
- **Files:** `.github/workflows/mobile-device-ui-maestro.yml`, `.github/workflows/mobile-groups-layout-diagnostics.yml`, `apps/mobile/eas.json`/`app.config.ts` (e2e env), `apps/mobile/.maestro/device-ui/{sign-in,assert-layout-probes,assert-groups-layout}.yaml`, `apps/mobile/lib/e2eLayoutProbes.ts`, new guard `__tests__/guards/e2eFlagsNotInProd.guard.test.ts`.
- **Acceptance:** (a) on one workflow run, iOS sim reaches Groups in `he` and `en` and uploads the measurement JSON; (b) the JSON shows the bug: the Hebrew card row width is below 80% of the English one, or the actual reproduced numbers; (c) the guard fails if a prod/store profile enables E2E flags or the dev Supabase URL; (d) a prod build config diff shows no E2E form or probes.
- **Budget (estimate):** ~25–40 macOS min per iOS run. Cap: 3 attempts per hypothesis, then stop and report.
- **Risks:** a wrong DB again → assert the Supabase host at app start in E2E mode and log it to the artifact. A flaky sign-in → wait on testIDs, never on sleeps.
- **Rollback:** the workflows are additive; revert the PR. Prod config is protected by the guard.

### Phase 1: Groups fix as the first consumer (#680, #681, #682, #699)
- **Deliverables:** `components/ui/StartEndRow.tsx` (one primitive: start/end slots, uses logical `flexDirection:'row'` and lets RTL mirroring happen natively, no nested reverse). `orderedRoutes(isRtl)` in the tab bar (`CustomTabBar`), including the Hebrew Profile↔Activity swap (#699). Migrate the Groups list/card and the settle sheet.
- **Acceptance:** sim probes in he, en and pseudo-long (Phase 2 locale, or the longest of the 7 until then) on 2 iOS sizes (small: iPhone SE-class; large: Pro Max-class) show: card row width within ±2pt between he and en; amount/name not wrapped beyond the spec line count; start/end x-order mirrored in he. Jest test for `orderedRoutes`. The red/green proof is the probe JSON failing on dev and passing on the PR. #679 gate satisfied. **Nave verifies on TestFlight before any main merge.**
- **Budget:** the dev PR runs smoke plus the Groups flows only (estimate ≤40 macOS min per push).
- **Risks:** the primitive breaks other screens → migrate only Groups and the tab bar here. Rollback: revert the PR; nothing else depends on it yet.

### Phase 2: Guard + migration + pseudo-locale
- **Deliverables:** `__tests__/guards/rtlRowPatterns.guard.test.ts` bans `row-reverse` and literal `direction:` outside `StartEndRow`/`hooks/useRtlLayout.tsx`, with an explicit allowlist that is the migration list (currently 11 `row-reverse` uses in 8 files and hardcoded direction in 10 files; the exact list is generated by the guard). Migrate one screen per PR, and the allowlist may only shrink. Add a long-text pseudo-locale (`xx-long`, about +40% length plus accented chars, mirroring Android `en-XA`; RTL coverage stays `he`, with Android `ar-XB` optional). It is available only in E2E builds.
- **Acceptance:** the guard is red on a test fixture with `row-reverse` and green on dev. The allowlist count is reported in CI and never increases. Every migrated screen has probe assertions in he, en and xx-long.
- **Budget:** Jest only, plus changed-screen sim runs. Rollback: per-screen PR revert.

### Phase 3: Approved visual baselines (Maestro `assertScreenshot`)
- **Deliverables:** cropped (element/region) screenshot assertions on key screens: Groups, Group detail, Activity, Profile, Settle sheet, Login. Run in he and en on one pinned iOS sim (model plus OS version pinned in `ios-simulator-devices.sh`) and one pinned Android AVD. Baselines are committed under `.maestro/baselines/<platform>/<device>/<locale>/`. Anti-flake: animations off (E2E flag plus OS reduce-motion), fixed clock and fixed seeded data in dev Supabase, status bar overridden (`xcrun simctl status_bar override`), fonts loaded before capture, only stable regions cropped.
- **Acceptance:** 10 consecutive runs on unchanged code give 0 diffs (flake check). A deliberate 1-line style change makes the relevant assertion fail. Threshold documented per Maestro docs.
- **Budget:** main full suite (estimate ≤60 macOS min per run); dev only changed screens via `scripts/lib/maestro-screen-flow-map.mjs`.
- **Rollback:** mark the screen `baseline: pending` (skip with an issue), never auto-regenerate.

### Phase 4: Release launch smoke + rollout safety
- **Deliverables:** a Release/production-profile build (dev mode off, Hermes) on sim and emulator: launch → first screen testID visible → no crash within 30s, with logcat/syslog scanned for fatal signals (per pepicrft). Play production uses **staged rollout** (e.g. 5%→20%→50%→100%, as an estimate to tune) with a halt rule. Sentry crash-free gate: promote only if crash-free sessions are ≥99.5% (target, to be confirmed against baseline) over ≥24h. Halting stays a manual Play Console action unless the API is wired up; the agent alerts Nave.
- **Acceptance:** the smoke test fails on a build with a deliberately injected startup throw and passes on dev. The release checklist doc lists the gate values.
- **Rollback:** halt the rollout in Play; iOS phased release pause.

### Phase 5: AWS Device Farm before store releases only
- Smoke flow on 2–3 real devices (1 small iPhone, 1 recent iPhone, 1 mid-range Android). Price: $0.17/device-minute, with a one-time 1,000 free minutes. Estimate: ~3 devices × 10 min ≈ $5 per release once the free minutes are used. Firebase Test Lab is excluded because it shuts down 2027-09-30.
- **Acceptance:** the run report is attached to the release PR; a failure blocks submission.

## 5. Baseline-approval workflow (live session with Nave)
1. Nave plus the agent with an open simulator (needs a Mac, see §9). The agent changes the design, and Nave looks at he and en on both pinned devices.
2. On "approved", the agent runs `maestro test --update-baselines`-equivalent capture on the **pinned CI sim config**. If local differs from CI, the baselines are generated by a `workflow_dispatch` job and downloaded.
3. Commit the baselines in a PR labelled `baseline-update` with before/after images. The PR body states "approved by Nave in session <date>".
4. A CI guard rejects baseline file changes in PRs without that label. Agents may never update baselines on their own.

## 6. Flake policy
- One automatic retry per flow. A pass-after-retry counts as **flaky**, is logged, and is tracked.
- A flow flaky more than 2 times in 10 runs is quarantined (non-blocking) with an urgent issue, and is fixed or deleted within 1 week.
- No `sleep`s; wait on testIDs only. Pinned devices and OS. Seeded data. A test that cannot be made deterministic is deleted, not tolerated.

## 7. Process rules
- Design changes happen only in live sessions with Nave. Bug fixes run autonomously only if Jest, guards and the relevant sim flows are green.
- A PR touching layout must attach sim probe JSON (red on base, green on head) under the #679 gate.
- dev: smoke (`sign-in`, `assert-layout-probes`, `visit-main-screens`) plus the changed screens. main/store: the full suite, release smoke and Device Farm.
- Merge to main or release only with Nave's OK and after his TestFlight verification. Max 2 cloud agents.

## 8. Metrics (reported in the progress updates)
| Metric | Source | Target (initial, estimate) |
|---|---|---|
| Crash-free sessions/users | Sentry (org kupay-hb) | ≥99.5% |
| Sim gate pass rate (first try) | GitHub Actions | ≥90% |
| Flaky rate | retry logs | <5% of flow runs |
| CI minutes per week (macOS/Linux) | Actions usage | track; alert if >2× previous week |
| RTL allowlist size | guard output | monotonic ↓ to 0 |
| Escaped UI bugs (found by Nave/users) | GitHub issues label | ↓ per release |

## 9. What needs Nave (minimal)
1. **Now:** does he have a Mac (with Xcode) for live sessions? If not, the fallback is a CI-captured sim recording or screenshots per change for async approval, which is slower.
2. **Phase 1 end:** verify Groups and tabs in TestFlight and OK the main merge.
3. **Phase 3:** one live session to approve the initial baselines (estimate 1–2h).
4. **Phase 5:** OK the AWS account/billing.
Everything else is done autonomously.
