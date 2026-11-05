# Payment app launcher tiles (Bit / PayBox)

**Status:** Implemented in mobile settle-up sheet (#700).

## Asset choice

KupaPay does **not** ship trademarked Bit or PayBox logo PNGs in the app bundle. No verified redistribution license for those marks exists in this repository. Instead, both launchers use **`PaymentAppLogo`** monogram tiles:

| App | Monogram | Light background | Dark background |
|-----|----------|------------------|-----------------|
| Bit | `bit` | `#FF6F00` | `#E65100` |
| PayBox | `PB` | `#5BC8F5` | `#039BE5` |

Colors align with publicly visible app-icon palettes (store listings). Official logos remain the property of Bank Hapoalim (Bit) and PayBox Ltd.

## Layout

- Tile size **56×56** px, corner radius **14** px — matches cash/card/PayPal method tiles in `SettleUpSheet`.
- `@2x`/`@3x`: vector text monograms scale cleanly; no raster logo assets.

## i18n / a11y

- Press target label: `settleUp.openPaymentApp` with `settleUp.paymentAppLabels.{bit,paybox}`.
- All seven mobile locales (`en`, `he`, `ru`, `ar`, `fr`, `es`, `de`); RTL layouts use the same LTR monogram inside the tile (`writingDirection: 'ltr'`).
