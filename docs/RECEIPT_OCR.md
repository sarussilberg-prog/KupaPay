# Receipt OCR (Pro v2) — heuristic v1

**Cost:** $0 by default. No vendor API keys required.

## Flow

1. Add Expense → Receipt → **Fill from receipt text** (Pro-gated when `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED`).
2. User pastes receipt text; `@cost-share/shared` `parseReceiptDraftFromText` pre-fills the form locally.
3. Optional edge function `receipt-ocr` accepts the same `text` for rate limiting and future vendor use.

## Edge function `receipt-ocr`

| Secret | Purpose |
|--------|---------|
| (none required) | Heuristic parse on `text` only |
| `RECEIPT_OCR_API_URL` | Optional vendor hook — POST `{ imageBase64 }`, expect `{ text }` |
| `RECEIPT_OCR_API_KEY` | Optional Bearer for vendor |

Without `RECEIPT_OCR_API_URL`, `imageBase64` alone returns `text_required` — clients must paste text (on-device path).

Deploy: `supabase functions deploy receipt-ocr`
