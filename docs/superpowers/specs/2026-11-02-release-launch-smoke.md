# Release launch smoke (UI quality Phase 4)

## Goal

Verify the **Release** simulator `.app` / APK (same artifact as Maestro CI) launches, renders the first screen, and stays alive **30 seconds** without a fatal crash.

## CI

- Workflow: `.github/workflows/mobile-device-ui-maestro.yml`
- Jobs: `launch-smoke-ios`, `launch-smoke-android` (after `build-ios` / `build-android`)
- Planner: `cost-share-app/scripts/lib/launch-smoke-ci-plan.mjs`

### When it runs

| Event | Launch smoke |
|-------|----------------|
| `main` push / PR to `main` / Maestro `full` tier | Always (when native mobile paths trigger the workflow) |
| `dev` PR | Native/boot paths (`NATIVE_TOUCH_PATTERNS` + boot entry files), **or** launch-smoke infra paths (workflow, `ci-release-launch-smoke.sh`, planner/tests), **or** PR label `launch-smoke` |

When launch smoke runs on a dev PR, **both** iOS and Android smoke jobs run (Android Maestro build is enabled even in smoke tier).

### Scripts

- `apps/mobile/scripts/ci-release-launch-smoke.sh` — install cached binary, launch, 30s alive check
- iOS: `simctl install/launch`, `kill -0` on launch PID, recent `KupaPay*.crash` in DiagnosticReports
- Android: `adb install`, `pidof`, logcat scan for `FATAL EXCEPTION`

## Red/green proof (injected crash)

Set `RELEASE_LAUNCH_SMOKE_INJECT_CRASH=1` — the script exits non-zero before launch.

Automated: `__tests__/guards/releaseLaunchSmoke.guard.test.ts` (`ios self-test` mode).

Manual CI verification (optional): temporarily set the env var on the launch-smoke job; job must fail; revert before merge.

## Rollout gates (reference)

Play staged rollout and Sentry crash-free targets are documented in the UI quality plan; halting remains a manual Play Console action until wired.
