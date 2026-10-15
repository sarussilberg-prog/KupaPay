# Receipt OCR (Pro)

Pro receipt scan calls the Supabase Edge Function `receipt-ocr`.

## Default (no paid API)

- Deploy `receipt-ocr` with JWT verification enabled (mobile calls with user session).
- Without `RECEIPT_OCR_API_URL` / `RECEIPT_OCR_API_KEY`, **image** uploads return `ocr_not_configured`.
- The app still attaches the receipt photo; users can edit fields manually.
- **Text parsing** works when the client sends `text` (future on-device OCR or paste).

## Optional external OCR provider

Set Edge Function secrets (dev + prod separately):

| Secret | Purpose |
|---|---|
| `RECEIPT_OCR_API_URL` | HTTPS endpoint that accepts `{ "imageBase64": "..." }` and returns `{ "text": "..." }` |
| `RECEIPT_OCR_API_KEY` | Bearer token sent to that endpoint |

KupaPay does not ship a paid OCR vendor. Wire your own (Google Vision, Azure, etc.) behind this stub.

## Client flag

Requires `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true` and active `pro` entitlement (or group Trip Pass).
