# KupaPay Pro — feature audit & roadmap proposal

Last updated: 2026-10-15. Scope: `cost-share-app` mobile (RevenueCat entitlement `pro`). Master flag: `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED`.

## Current Pro vs free (as implemented in code)

| Feature | Free tier | Pro (subscription or active group pass) | Code / notes |
|--------|-----------|-------------------------------------------|--------------|
| **Expenses & splits** | Unlimited groups, members, expenses, settlements | Same | No expense count caps in app or DB. |
| **Core balances & settle-up** | Full access | Same | — |
| **CSV group export** | Always available | Same | `GroupExportSheet`: only PDF/Excel gated. |
| **PDF / Excel group export** | Locked (paywall) | Unlocked | `GroupDetailScreen` → `exportProLocked`. |
| **Rewarded ads (Remind flow)** | Watch ad (or continue if unavailable) | Skip ad gate | `AdGateStep` + `shouldSkipAdGate`. |
| **Rewarded ads (multi-currency consolidate)** | Watch ad to run consolidation | Skip ad gate | `ConsolidateCurrencySheet` → `AdGateStep`. |
| **Trip currency view** | Upsell card only (component exists) | Convert all pairwise debts to one currency | `GroupTripCurrencySection` — **UI built, not yet mounted** on a screen; paywall copy promises this perk. |
| **Trip Pass (IAP)** | N/A (one-time purchase) | 30-day Pro for **all members** of one group | `kupapay_trip_pass`; yearly sub includes 1 redeemable credit. |
| **No ads (marketing)** | Ads on gated flows | “No ads” on paywall | Ad skip is implemented; no banner ads elsewhere. |

**Entitlement sources:** Individual subscription (`profiles.pro_until` via RevenueCat webhook), group Trip Pass (`group_passes`), included yearly Trip Pass credit (`included_trip_pass_credits`). Resolved by `get_my_pro_status` / `has_pro`.

**Free tier principle:** Keep unlimited expenses and full splitting; monetize convenience (exports, ads removal, trip tooling), not core ledger access.

---

## Proposed additional Pro features (6–10)

| # | Feature | User value | Effort | Partially exists? |
|---|---------|------------|--------|-------------------|
| 1 | **Live multi-currency trip FX** (mount trip currency section + refresh rates) | Travel groups see one currency without mental math | **M** | `GroupTripCurrencySection`, `tripCurrencyConversion`, exchange rates query; not wired in group UI |
| 2 | **Receipt OCR → draft expense** | Faster entry after meals/shopping | **L** | Camera/attachments on expenses may exist; no OCR pipeline |
| 3 | **Recurring / scheduled expenses** | Rent, subscriptions, weekly groceries auto-posted | **L** | No recurrence model in schema |
| 4 | **Spending insights & charts** | Category trends, per-member totals, trip burn-down | **M** | Raw expense data + categories exist; no analytics UI |
| 5 | **Custom categories & group themes** | Brand trips, clearer reports | **S–M** | Fixed category set today; group avatar/name only |
| 6 | **Payment reminders (smart nudges)** | Reduce awkward “you still owe me” | **S** | Remind flow + push infra exist; Pro could add scheduling/templates |
| 7 | **Export pack** (email CSV/PDF, accounting formats) | Share with accountant or partner | **S** | CSV/PDF/Excel export exists; Pro gating on PDF/Excel only |
| 8 | **Trip budget & alerts** | Cap spend per trip currency | **M** | Group totals exist; no budget targets |
| 9 | **Ad-free everywhere + priority flows** | Polish for power users | **S** | Ad gate skip for Pro; extend to any future ad surfaces |
| 10 | **Web Pro parity** | Same perks on desktop | **M** | Pro is mobile-native (RevenueCat); web has no purchases |

---

## Top 5 recommendations (highest ROI)

1. **Ship trip currency view (wire `GroupTripCurrencySection`)** — already built and advertised on paywall; closes expectation gap. **Effort: M**
2. **Receipt OCR draft expense** — strong differentiation for travel/expense apps. **Effort: L**
3. **Spending insights (category + member charts)** — increases weekly engagement without limiting free splits. **Effort: M**
4. **Trip budget with soft alerts** — natural fit for group trips and Pro positioning. **Effort: M**
5. **Smart payment reminders (scheduled / digest)** — builds on Remind + push; clear Pro upsell. **Effort: S–M**

---

## Free trial (App Store)

- Products `kupapay_pro_monthly` / `kupapay_pro_yearly`: 7-day intro offer (App Store Connect).
- Paywall: eligibility via `checkTrialOrIntroductoryPriceEligibility`, localized CTA + Apple disclosure.
- Reminder: local notification 2 days before trial end; server fallback `pro-trial-reminder-dispatch` (daily cron + `PUSH_WEBHOOK_SECRET`).
