# ASO metadata (prepare-only)

Repository copies of **App Store Connect** and **Google Play** listing text for KupaPay in all seven product locales (`en`, `he`, `ru`, `ar`, `fr`, `es`, `de`).

## Policy

- **Prepare only** — edit these files in git; do **not** submit for App Store / Play review from automation without explicit owner approval.
- **Do not** change live store listings directly from CI (see `asc-ios-release-prep` and Play internal workflows).

## Layout

| Path | Store | Contents |
|------|-------|----------|
| `ios/<locale>/title.txt` | Apple | App name (≤30 chars) |
| `ios/<locale>/subtitle.txt` | Apple | Subtitle (≤30 chars) |
| `ios/<locale>/keywords.txt` | Apple | Keyword field (≤100 chars, comma-separated) |
| `../play/<locale>/` | Google | `title.txt`, `short_description.txt`, `full_description.txt` |
| `keyword-research.md` | — | Free-tool research notes per locale |
| `keyword-rankings.csv` | — | Baseline ranks (fill after Search Console / store analytics) |
| `locale-manifest.json` | — | Maps app locale → ASC locale codes |

## Applying to stores (manual)

1. **iOS:** Copy from `store/aso/ios/` into App Store Connect → App Information / version localizations. Use `locale-manifest.json` for ASC locale codes (`en-US`, `ar-SA`, …).
2. **Android:** Copy from `store/play/<locale>/` into Play Console listing fields.
3. Update `keyword-rankings.csv` monthly with rank snapshots.

## Screenshots & IAP

- iOS screenshots: `store/screenshots/ios/`
- ASC IAP / What's New: `store/asc/`
- Play graphics: `store/play/graphics/`
