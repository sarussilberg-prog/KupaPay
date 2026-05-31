# Balance Screen Refactor — Design Spec

Date: 2026-05-31
Branch: fix/settle-up-date-picker
Status: **brainstormed; pending implementation plan**

## Goal

Restructure `BalancesScreen` around three stacked sections so the screen reads top-down as "what the group spent → who paid → what's left to settle":

1. A new **Group Totals** card at the top, currency-aware.
2. A subtler **Members** section, dense rows in a single card instead of one card per member.
3. The existing **Simplified Debts** section, with debts that don't involve the current user collapsed behind a toggle (matching the pattern already in `SettleUpListScreen`).

The drill-in `MemberContributionDialog` ("who paid for whom" matrix) is unchanged.

## Scope

**In scope.**
- New `GroupTotalsCard` component showing **Total spent** (per currency), **Unsettled** (per currency), and **Expense count**.
- Restyle of `MemberContributionRow` and its container layout in `BalancesScreen` so all member rows live inside one white card with hairline dividers, small avatars (real images when available, initials fallback), name, and per-currency `paid` amounts on the right.
- Remove the `BalanceModeToggle` and the "Spent on" mode entirely from `BalancesScreen`. Member rows always render in `paid` mode.
- Split `SimplifiedDebtsSection` into involved / non-involved debts and collapse non-involved behind a `TouchableOpacity` toggle identical to `SettleUpListScreen.tsx`'s `settleUp.othersToggle` row.
- Add `expenseCount` to `MemberContributionsResult` in `@cost-share/shared` so the totals card has the count without a new query.
- i18n: add EN/HE keys for the new strings; remove keys that become unreferenced after the mode-toggle removal (verify with grep before deleting).

**Explicitly out of scope.**
- `MemberContributionDialog` UI and contents.
- `SettleUpSheet` and the settlement flow.
- `SettleUpListScreen` itself (we mirror its toggle pattern; we don't touch it).
- Settlement history on `BalancesScreen` (today's screen doesn't show it; that stays in `SettleUpListScreen`).
- Any change to the shared simplification / contribution math beyond the new `expenseCount` field.
- Realtime, data invalidation, navigation, and route params — unchanged.

## Locked decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Mode toggle | Removed. Member rows always show what each member paid (gross). |
| 2 | Top summary content | Total spent + Total unsettled + Expense count (3 stats). |
| 3 | Member-list style | Variant A — dense rows in one shared white card, hairline dividers, no per-row card. |
| 4 | Avatars on rows | Use real profile image when present (`avatarUrl`); fall back to initials via existing `MemberAvatar`. Size `xs`. |
| 5 | Row tap behavior | Unchanged — opens `MemberContributionDialog` with the existing matrix view. |
| 6 | Non-involved debts | Collapsed behind a toggle styled identically to `SettleUpListScreen`. Reuses `settleUp.othersToggle` i18n key. |
| 7 | Toggle state location | Local to `SimplifiedDebtsSection` (`useState`), not lifted. |
| 8 | "Minimum" badge + "X payments to settle" header | Kept. Count is total across involved + non-involved. |
| 9 | "All settled up!" empty state | Unchanged. |
| 10 | Expense count source | New `expenseCount: number` field on `MemberContributionsResult`. No new query. |
| 11 | Total spent source | Sum of all members' `paid` per currency from existing contributions data. Equivalent to `calculateGroupTotalSpent(expenses)`, no extra fetch. |
| 12 | Total unsettled source | `calculateGroupTotalUnsettled(debts)` over the flattened `simplifiedByCurrency` entries. |

## Architecture

### Component layout

```
BalancesScreen
└── ScrollView (RefreshControl unchanged)
    ├── GroupTotalsCard               (new)
    ├── View (members wrapper card)   (inline in BalancesScreen)
    │   └── MemberContributionRow[]   (restyled; no `mode` prop)
    └── SimplifiedDebtsSection        (refactored: involved / others split)
```

### New / changed files

```
cost-share-app/apps/mobile/components/balances/
├── GroupTotalsCard.tsx          NEW
├── BalanceModeToggle.tsx        DELETED
├── MemberContributionRow.tsx    RESTYLED, props simplified
├── SimplifiedDebtsSection.tsx   REFACTORED (involved / others split)
└── (CurrencyAmountList, DebtRow, MemberContributionDialog — unchanged)

cost-share-app/apps/mobile/screens/balances/
└── BalancesScreen.tsx           REFACTORED (drop toggle; new card; render order)

cost-share-app/packages/shared/src/calculations/
└── memberContributions.ts       Add `expenseCount` to MemberContributionsResult

cost-share-app/apps/mobile/i18n/locales/
├── en.json                      add new keys, remove unreferenced ones
└── he.json                      mirror new keys, remove unreferenced ones
```

### `GroupTotalsCard`

```ts
interface GroupTotalsCardProps {
    totalSpent: CurrencyAmount[];   // sum of paid across members
    unsettled: CurrencyAmount[];    // sum of simplified debts
    expenseCount: number;
    defaultCurrency: string;        // for sortCurrencyAmounts
}
```

Renders one white rounded card containing three stat rows separated by hairline dividers:

1. `Total spent` — label on the left, `CurrencyAmountList` on the right (one line per currency).
2. `Unsettled` — same structure; `CurrencyAmountList` shows its built-in empty state when the group is fully settled.
3. `Expenses` — count with pluralised label (`balances.expenseCount_one` / `_other`).

### `MemberContributionRow` (restyled)

New props (`mode` removed):

```ts
interface MemberContributionRowProps {
    userId: string;
    name: string;
    avatarUrl?: string;
    amounts: CurrencyAmount[];   // always "paid"
    isCurrentUser?: boolean;
    isLast?: boolean;            // controls bottom divider
    onPress: () => void;
}
```

Visual:

- No per-row card background, no `mb-2`.
- Padding `py-3 px-4` (lighter than today's `p-4`).
- Hairline `border-b border-slate-100` except for last row (controlled by `isLast`).
- `MemberAvatar` at `size="xs"` so real images shrink correctly, initials fall back unchanged.
- Right-aligned `CurrencyAmountList` with `text-sm font-semibold text-gray-900`.
- No "X paid" label line; the section header carries that context.

`BalancesScreen` wraps all rows in one `<View className="bg-white rounded-xl overflow-hidden">` and passes `isLast={idx === sortedMembers.length - 1}` to suppress the trailing divider.

### `SimplifiedDebtsSection` (refactored)

Internally:

```ts
const [othersExpanded, setOthersExpanded] = useState(false);

// Flatten and split (preserves currency-sort already in entries).
const { involved, others } = useMemo(() => {
    const inv: { entry; debt }[] = [];
    const oth: { entry; debt }[] = [];
    for (const e of entries) {
        for (const d of e.result.debts) {
            const isMine = d.fromUserId === currentUserId || d.toUserId === currentUserId;
            (isMine ? inv : oth).push({ entry: e, debt: d });
        }
    }
    return { involved: inv, others: oth };
}, [entries, currentUserId]);
```

Render order:

1. Header row (count + optional `minimumBadge`) — unchanged.
2. `involved` rows (always visible, same `DebtRow`).
3. Toggle pill (`settle-others-toggle` testID, reuses `settleUp.othersToggle` i18n) — only when `others.length > 0`.
4. `others` rows — only when `othersExpanded`.

Empty state ("All settled up!") still triggers on `involved.length === 0 && others.length === 0`.

### Shared package change

```ts
// memberContributions.ts
export interface MemberContributionsResult {
    totals: MemberTotals[];
    matrix: MatrixRow[];
    expenseCount: number;        // NEW
}
```

`calculateMemberContributions` returns `expenseCount = expenses.length` (where `expenses` is the input array — i.e. count of non-deleted, non-settlement expenses already filtered by the caller).

### Data flow

```
useGroupContributionsQuery(groupId)
    .totals[].paid → MemberContributionRow.amounts
    sum of all .totals[].paid per currency → GroupTotalsCard.totalSpent
    .expenseCount → GroupTotalsCard.expenseCount

useGroupSimplifiedDebtsByCurrencyQuery(groupId)
    entries → SimplifiedDebtsSection (involved / others split inside)
    flatten + calculateGroupTotalUnsettled → GroupTotalsCard.unsettled
```

No new queries, no new RPCs, no new subscriptions.

### Loading / empty / error

- Initial load: existing `LoadingIndicator` gate unchanged.
- `GroupTotalsCard` always renders once data is loaded; each `CurrencyAmountList` row carries its own empty-state copy.
- `SimplifiedDebtsSection` keeps the "All settled up!" empty card.
- Pull-to-refresh unchanged.
- Hebrew RTL: every new text is right-aligned via `CurrencyAmountList`/existing `useRtlLayout` patterns.

### i18n

Add to `balances`:

```
groupTotals           = "Group totals"
totalSpent            = "Total spent"
unsettled             = "Unsettled"
expenseCount_one      = "1 expense"
expenseCount_other    = "{{count}} expenses"
membersSectionLabel   = "Members"
```

Mirror in `he.json`.

Remove (after grep-verifying no other callers):

```
balances.modeToggle.paid
balances.modeToggle.spentOn
balances.paidMode.row
balances.paidMode.rowYou
balances.spentOnMode.row
balances.spentOnMode.rowYou
```

Keep `balances.paidMode.detailSection*` and `balances.spentOnMode.detailSection*` if `MemberContributionDialog` still references them (verify in implementation).

Reuse existing keys:
- `settleUp.othersToggle` (already EN + HE) for the new toggle.
- `balances.paymentsToSettle_{one|other}`, `balances.minimumBadge`, `balances.allSettled`, `balances.noDebts` — unchanged.
- `balances.noActivityInMode` — unchanged (used by `CurrencyAmountList`'s empty state).

## Testing

New / updated tests:

- `__tests__/components/balances/GroupTotalsCard.test.tsx` — NEW
  - Renders three stats.
  - Multi-currency total renders one line per currency.
  - Empty unsettled shows the empty-state line.
  - Pluralisation of expense count (`1 expense` vs `5 expenses`).
- `__tests__/components/balances/MemberContributionRow.test.tsx` — UPDATE
  - No `mode` prop accepted; rendering paid amounts only.
  - Real avatar image renders when `avatarUrl` set.
  - `isLast` suppresses the bottom divider.
  - `onPress` still fires (drill-in unchanged).
- `__tests__/components/balances/SimplifiedDebtsSection.test.tsx` — NEW or UPDATE
  - Splits into involved / others by `currentUserId`.
  - Toggle hides others by default, shows on press.
  - `minimumBadge` and count text unchanged.
  - All-settled empty state still triggers on full zero.
- `__tests__/screens/balances/BalancesScreen.test.tsx` — UPDATE
  - No mode toggle present.
  - `GroupTotalsCard` visible with totals.
  - Row tap opens `MemberContributionDialog`.
  - Refresh control still calls all three refetches.
- `packages/shared` contribution tests — add `expenseCount` assertion.

## Risks / open questions

- **Dialog mode dependency.** `MemberContributionDialog` currently takes a `mode` prop. If it still reads it, we pass `'paid'` constantly from `BalancesScreen` and leave the dialog internals alone. If the dialog UI shows a "Spent on" view, we keep that — the screen-level toggle removal does **not** remove the matrix's per-direction view. Verify in implementation; do not delete dialog modes unless trivially unused.
- **Currency sort.** Both totals and unsettled lines render with the group's `default_currency` first via `sortCurrencyAmounts` from `@cost-share/shared`. `BalancesScreen` already reads the group from the store; pass `defaultCurrency` into `GroupTotalsCard`.
- **Mock data for tests.** Existing test fixtures supply `totals` and `matrix`. Adding `expenseCount` will require fixture updates across shared + mobile tests.
