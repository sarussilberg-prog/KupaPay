# RTL verification screenshots

Captured in CI (not committed by default — binary churn). After a green **Mobile device UI (Maestro)** run:

| Artifact | Contents |
|----------|----------|
| `maestro-device-ui-ios-<run_id>` | `${MAESTRO_PLATFORM}_${APP_LANG}_*.png` from `visit-main-screens`, `rtl-main-screens-tour-en/he`, layout diagnostics |
| `maestro-device-ui-android-<run_id>` | Same flows on Android emulator when the plan enables Android |
| Playwright `expo-web-rtl-layout` | Bounding-box assertions on `group-card-probe-*` in B2 preview (`e2e/expo-web-rtl-layout.spec.ts`) |

Local capture:

```bash
# Expo web B2 preview (all 7 locales)
cd cost-share-app/apps/mobile && node scripts/capture-groups-list-locale-screenshots.mjs

# Playwright RTL order checks (requires dev server on :8081)
cd cost-share-app && E2E_EXPO_WEB_URL=http://127.0.0.1:8081 npm run test:e2e -- e2e/expo-web-rtl-layout.spec.ts
```

Maestro (simulator / emulator):

```bash
APP_LANG=he MAESTRO_PLATFORM=ios bash apps/mobile/scripts/ci-maestro-device-ui.sh ios test
# flows: .maestro/device-ui/rtl-main-screens-tour-he.yaml
```
