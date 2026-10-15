# Translation questions (i18n expansion)

Strings below need product/copy review — machine-assisted drafts may not match intended meaning in all locales.

## Domain terminology

| Key | English source | Question |
|-----|----------------|----------|
| `groups.*` / `tabs.groups` | "Groups" vs Hebrew "קופות" (kitty/pool) | Should Russian/Arabic/French/Spanish/German use a **shared-expense pool** metaphor (like Hebrew) or a neutral **"group"** label (like English)? |
| `favoriteGroup.*` | "Favorite Group" | Is this a **pinned** group for quick access, or a **preferred default** group? Affects word choice (e.g. FR « épinglé » vs « favori »). |
| `onboarding.welcome.tagline` | "Split expenses with your crew" | Is **"crew"** intentionally informal/slang, or should it be neutral ("friends", "group") in all languages? |
| `auth.tagline` | "Your shared kitty with friends" | **"Kitty"** (UK informal pooled money) — localize literally, map to Hebrew-style "kupa", or use generic "shared fund"? |
| `consolidation.*` | "Consolidate" / debt simplification | Confirm this always means **debt simplification** (minimum transfers), not **currency conversion** or **merging groups**. |

## Balances & settlements

| Key | English source | Question |
|-----|----------------|----------|
| `balances.youOwe` / `balances.youAreOwed` | Directional balance labels | Should these stay **second person** ("You owe") or match languages that prefer **name + verb** (e.g. "Sarah owes you") in list headers? |
| `settleUp.*` | "Settle up" | Informal idiom — prefer **literal "settle debts"**, **"pay back"**, or keep casual tone? |
| `remind.*` (strings only; no payment logic changed) | Reminder copy tone | Formal ("Payment reminder") vs friendly nudge — which brand voice for new locales? |

## Admin & edge cases

| Key | English source | Question |
|-----|----------------|----------|
| `admin.*` | Admin-only surfaces | Are admin UI strings user-visible enough to require human review, or is English acceptable for admin-only until dedicated review? |
| `legal.*` (in-app sheet titles) | Terms / Privacy | Legal **content** remains EN/HE in Supabase; UI chrome is translated. OK to show EN/HE document body under AR/RU UI until localized legal docs exist? |

## Pluralization

| Context | Question |
|---------|----------|
| Hebrew extra plural keys (`_two`, `_many`) | Arabic and Russian need locale-specific plural forms for i18next. OK to ship with `_one` / `_other` only (fallback rules) until native plural review, or block release until `ar`/`ru` plural keys match `he` depth? |

---

After copy decisions, update locale JSON and remove resolved rows from this file.
