# Remind: include all debts owed to the sender — design

Date: 2026-06-30

## Problem

The "Send a Reminder" flow (`RemindFlowSheet`) prefills a message that mentions
only the single debt row the user tapped, e.g.:

> היי, רק תזכורת שאתה חייב 2179.40 ILS ב-פיצה 😊

When the reminded user (B) owes the sender (A) in more than one currency within
the group, only the tapped currency appears. The reminder should cover every
currency B owes A in this group.

## Scope (confirmed)

- List **all debts where B owes A**, within the **current group**.
- One entry per currency (debts are already stored one row per currency).
- Out of scope: debts B owes other people, and debts in other groups.
- No backend / service / push change — `sendSettleReminder` and
  `shareSettleReminder` only transmit the composed message string. This is
  purely a change to the default message text.

## Message format

Keep the existing `remind.defaultMessage` template
(`...you owe {{amount}} in {{groupName}} 😊`). Make `{{amount}}` a localized
list when there are multiple currencies:

- 1 currency: `ILS 2179.40` (unchanged behaviour)
- 2 currencies: `USD 24.00 and ILS 45.00`
- 3+ currencies: `USD 24.00, ILS 45.00 and EUR 10.00`

Joining is localized:
- EN: comma between all but the last two, `" and "` before the last.
- HE: `" ו"` (vav, no space after) before the last; comma otherwise.

## Implementation

1. **`SettleUpListScreen.tsx` → `buildDefaultMessage`** (currently builds a
   single `CUR 0.00` string from `remindTargetDebt`):
   - Filter the in-scope `debts: PairwiseDebt[]` for
     `fromUserId === target.fromUserId && toUserId === target.toUserId`.
   - Fall back to the single `remindTargetDebt` if the filter is empty (data
     race / not found) so the message is never blank.
   - Map each match to `` `${currency} ${amount.toFixed(2)}` ``.
   - Sort deterministically (e.g. by currency code) so the order is stable.
   - Join with a small `joinAmounts(parts, t)` helper using the localized
     "and".
   - Pass the joined string as `{{amount}}` to `remind.defaultMessage`.

2. **i18n** — add a join-word key used by `joinAmounts`:
   - `remind.amountAnd` → EN `" and "`, HE `" ו"`.
   - (Comma separator `", "` is hardcoded; same in both locales.)

3. No change to `remindTargetDebt` shape, `RemindFlowSheet`, services, push
   pipeline, or the `defaultMessage` template itself.

## Testing

- Single-currency debt → message unchanged from today.
- Two-currency debt → `"...you owe USD 24.00 and ILS 45.00 in <group> 😊"`.
- Three-currency debt → comma list + final "and".
- Hebrew locale → vav join.
- Empty filter fallback → uses the tapped debt's single amount.
