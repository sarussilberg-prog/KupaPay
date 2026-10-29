# Google Play store listing assets (KupaPay)

ASO research, iOS keyword drafts, and rank tracking: [`../aso/README.md`](../aso/README.md).

| Path | Purpose |
|------|---------|
| `<locale>/title.txt` | Store title (≤30 chars recommended) |
| `<locale>/short_description.txt` | Short description (≤80 chars) |
| `<locale>/full_description.txt` | Full description |
| `graphics/feature-graphic-1024x500.png` | Feature graphic |
| `../screenshots/android/<locale>/` | Phone screenshots (1080×1920, caption overlays) — see [store/screenshots/README.md](../screenshots/README.md) |
| `graphics/phone/*.png` | Legacy English placeholders; prefer `../screenshots/android/` |
| `DATA_SAFETY_ANSWERS.md` | Data safety form draft |
| `CONTENT_RATING_ANSWERS.md` | IARC questionnaire draft |
| `SUBSCRIPTION_OFFERS.md` | Play base-plan **14-day** free trial; no Android EU waiver |

Locales: `en`, `he`, `ru`, `ar`, `fr`, `es`, `de`.

## Regenerate localized phone screenshots (recommended)

```bash
cd cost-share-app/apps/mobile
npm run capture:store-screenshots
```

Outputs: `store/screenshots/android/{en,he,ru,ar,fr,es,de}/*.png`. Full steps: [store/screenshots/README.md](../screenshots/README.md).

## Legacy placeholder frames (English only)

```bash
python3 store/play/scripts/generate-play-graphics.py
```

## Real device screenshots (Maestro)

1. Seed dev Supabase (`npm run seed` in `cost-share-app/`) — see [docs/SCREENSHOTS_SEED.md](../docs/SCREENSHOTS_SEED.md).
2. Build a dev client: `cd cost-share-app/apps/mobile && npm run android:run`.
3. Install [Maestro](https://maestro.mobile.dev/) and run flows under `store/play/maestro/`:

```bash
cd cost-share-app/apps/mobile
maestro test ../../store/play/maestro/capture-screenshots.yaml
```

Copy outputs from the configured path into `store/play/graphics/phone/` before uploading to Play Console.

**Do not** publish to production or run paid Play Console promotions from CI — internal testing only.
