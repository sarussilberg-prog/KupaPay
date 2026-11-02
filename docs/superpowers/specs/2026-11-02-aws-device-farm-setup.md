# AWS Device Farm setup (UI quality Phase 5)

Manual **workflow_dispatch** only. The workflow stays **OFF** until Nave sets the repository variable `DEVICE_FARM_ENABLED` to `true` (default unset).

Workflow file: [`.github/workflows/device-farm-real-devices.yml`](../../../.github/workflows/device-farm-real-devices.yml)

## Cost estimate

- AWS Device Farm: **$0.17 per device-minute** (plus optional unmetered slots).
- New AWS accounts receive a **one-time 1,000 free device-minutes**.
- Example smoke (3 devices × ~10 minutes each): **~30 device-minutes ≈ $5.10** after free tier is exhausted.
- Firebase Test Lab is **not** used (service ends 2027-09-30 per plan).

## What Nave needs to do (no resources created by the repo)

1. **AWS account** with billing enabled and Device Farm access in the chosen region (e.g. `us-west-2`).
2. **IAM user** (or OIDC role later) with policies allowing at minimum:
   - `devicefarm:CreateUpload`, `devicefarm:GetUpload`, `devicefarm:ScheduleRun`, `devicefarm:GetRun`, `devicefarm:ListRuns`
   - S3 permissions required by Device Farm for upload URLs (scoped to Device Farm–managed buckets).
3. **Device Farm project** — create in AWS Console → Device Farm → **New project** (e.g. `KupaPay-Mobile`). Copy **project ARN**.
4. **Device pool** — create a pool with **2–3 devices** (suggested):
   - 1 small iPhone (e.g. iPhone SE class)
   - 1 recent iPhone (e.g. iPhone 15/16 class)
   - 1 mid-range Android (e.g. Pixel 6 / Samsung A series)
   Copy **device pool ARN**.
5. **Maestro / Appium test package** (one-time): bundle Maestro smoke flows (`sign-in`, `assert-layout-probes`, `visit-main-screens`) as an **Appium Node** test package in Device Farm; upload via console or CLI and copy **test package ARN** (and **test spec ARN** if used).
6. **GitHub repository configuration**
   - Variable: `DEVICE_FARM_ENABLED` = `true` (when ready).
   - Secrets:
     - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
     - `DEVICE_FARM_PROJECT_ARN`, `DEVICE_FARM_DEVICE_POOL_ARN`
     - `DEVICE_FARM_TEST_PACKAGE_ARN` (and optionally `DEVICE_FARM_TEST_SPEC_ARN`)
     - Existing E2E secrets: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`
7. **Release binary**: Android reuses the **Maestro cached Release APK** (`maestro-android-apk-<fingerprint>`). iOS requires a **.ipa** path via `DEVICE_FARM_IOS_APP_PATH` until a CI ipa artifact is wired.

## Running

1. Ensure a green Maestro **Release** build exists for the target native fingerprint (run Mobile device UI workflow on `main` or dispatch `full`).
2. Actions → **AWS Device Farm (real devices)** → **Run workflow**.
3. Attach the uploaded **`device-farm-run-report-*`** artifact to the store release PR; a failed run blocks submission (process rule).

## Acceptance (Phase 5)

- Run report attached to release PR.
- Failure blocks store submission.
