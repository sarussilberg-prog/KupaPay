# Balance Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `BalancesScreen` around a new top-level "Group Totals" card, a subtler members list, and a Simplified Debts section whose non-involving debts collapse behind a toggle.

**Architecture:** Three stacked sections inside the existing `ScrollView`. New `GroupTotalsCard` component on top, member rows render inside one shared card with hairline dividers (no `mode` toggle, always "paid"), refactored `SimplifiedDebtsSection` splits debts into involved / others using the same UX pattern already in `SettleUpListScreen`. Shared `MemberContributionsResult` gains an `expenseCount` field so the totals card has the count without a new query.

**Tech Stack:** React Native + Expo, NativeWind (Tailwind classes), TypeScript, React Query, Jest + `@testing-library/react-native`, i18next.

---

## File Structure

```
cost-share-app/packages/shared/src/calculations/
└── memberContributions.ts       MODIFY  add expenseCount field

cost-share-app/apps/mobile/__tests__/shared/
└── memberContributions.test.ts  MODIFY  assert expenseCount

cost-share-app/apps/mobile/components/balances/
├── balanceMode.ts               CREATE  homes the BalanceMode type (was inside BalanceModeToggle.tsx)
├── BalanceModeToggle.tsx        DELETE  (in last task)
├── GroupTotalsCard.tsx          CREATE  three-stat card (totalSpent / unsettled / expenseCount)
├── MemberContributionRow.tsx    MODIFY  drop mode prop, restyle to dense row
├── MemberContributionDialog.tsx MODIFY  import BalanceMode from ./balanceMode
├── MemberContributionBreakdown.tsx MODIFY  import BalanceMode from ./balanceMode
└── SimplifiedDebtsSection.tsx   MODIFY  involved / others split + toggle

cost-share-app/apps/mobile/__tests__/components/balances/
├── GroupTotalsCard.test.tsx     CREATE
├── MemberContributionRow.test.tsx CREATE (didn't exist before)
└── SimplifiedDebtsSection.test.tsx CREATE

cost-share-app/apps/mobile/screens/balances/
└── BalancesScreen.tsx           MODIFY  drop toggle, add totals card, single members card

cost-share-app/apps/mobile/__tests__/screens/balances/
└── BalancesScreen.test.tsx      REWRITE  drop toggle/mode tests, add totals + others-toggle tests

cost-share-app/apps/mobile/i18n/locales/
├── en.json                      MODIFY  add new keys, remove unreferenced
└── he.json                      MODIFY  mirror EN
```

---

## Task 1: Add `expenseCount` to shared `MemberContributionsResult`

**Files:**
- Modify: `cost-share-app/packages/shared/src/calculations/memberContributions.ts`
- Test: `cost-share-app/apps/mobile/__tests__/shared/memberContributions.test.ts`

- [ ] **Step 1: Add failing test for `expenseCount`**

Open `cost-share-app/apps/mobile/__tests__/shared/memberContributions.test.ts`. Find the existing `describe('calculateMemberContributions', ...)` block. Append this test at the end of the block (before its closing `});`):

```ts
it('returns expenseCount equal to the number of input expenses', () => {
    const empty = calculateMemberContributions({
        userIds: ['A'],
        expenses: [],
        splits: [],
    });
    expect(empty.expenseCount).toBe(0);

    const populated = calculateMemberContributions({
        userIds: ['A', 'B'],
        expenses: [
            { id: 'e1', paidBy: 'A', amount: 100, currency: 'USD' },
            { id: 'e2', paidBy: 'B', amount: 60, currency: 'ILS' },
            { id: 'e3', paidBy: 'A', amount: 20, currency: 'USD' },
        ],
        splits: [],
    });
    expect(populated.expenseCount).toBe(3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `cost-share-app/apps/mobile`:
```
npx jest __tests__/shared/memberContributions.test.ts -t "expenseCount"
```
Expected: FAIL with `expect(received).toBe(expected)` because `expenseCount` is `undefined`.

- [ ] **Step 3: Add the field to the result type and implementation**

Open `cost-share-app/packages/shared/src/calculations/memberContributions.ts`.

Replace the `MemberContributionsResult` interface (lines 33–36 in the current file) with:

```ts
export interface MemberContributionsResult {
    totals: MemberContributionTotals[];
    matrix: PaidByMatrixRow[];
    expenseCount: number;
}
```

At the bottom of `calculateMemberContributions`, change the existing `return` line:

```ts
    return { totals, matrix };
```

to:

```ts
    return { totals, matrix, expenseCount: expenses.length };
```

- [ ] **Step 4: Run the new test and verify it passes**

```
npx jest __tests__/shared/memberContributions.test.ts -t "expenseCount"
```
Expected: PASS.

- [ ] **Step 5: Run the full shared-calc test file to verify no regressions**

```
npx jest __tests__/shared/memberContributions.test.ts
```
Expected: PASS (all existing tests still green).

- [ ] **Step 6: Update the fallback in `groups.service.ts` so its catch path still satisfies the new type**

Open `cost-share-app/apps/mobile/services/groups.service.ts`. Around line 530 (inside `getGroupContributions`'s `catch`), update the fallback return:

Find:
```ts
        return { totals: [], matrix: [] };
```
Replace with:
```ts
        return { totals: [], matrix: [], expenseCount: 0 };
```

- [ ] **Step 7: Typecheck the mobile package**

From `cost-share-app/apps/mobile`:
```
npx tsc --noEmit
```
Expected: PASS with no errors. If there are errors about missing `expenseCount` in test fixtures, fix them by adding `expenseCount: 0` (or the correct number) to those literal objects — and ONLY those — until typecheck is clean.

- [ ] **Step 8: Commit**

```
git add cost-share-app/packages/shared/src/calculations/memberContributions.ts \
        cost-share-app/apps/mobile/__tests__/shared/memberContributions.test.ts \
        cost-share-app/apps/mobile/services/groups.service.ts
# also stage any test fixture files updated in step 7
git status
git commit -m "feat(shared): add expenseCount to MemberContributionsResult"
```

---

## Task 2: Move `BalanceMode` type to its own module

We're about to delete `BalanceModeToggle.tsx`, but `MemberContributionDialog.tsx` and `MemberContributionBreakdown.tsx` still import the `BalanceMode` type from it. Move the type to a tiny dedicated module first so deletion in Task 7 is a clean drop.

**Files:**
- Create: `cost-share-app/apps/mobile/components/balances/balanceMode.ts`
- Modify: `cost-share-app/apps/mobile/components/balances/BalanceModeToggle.tsx`
- Modify: `cost-share-app/apps/mobile/components/balances/MemberContributionDialog.tsx`
- Modify: `cost-share-app/apps/mobile/components/balances/MemberContributionBreakdown.tsx`

- [ ] **Step 1: Create the new module**

Write `cost-share-app/apps/mobile/components/balances/balanceMode.ts`:

```ts
export type BalanceMode = 'paid' | 'spentOn';
```

- [ ] **Step 2: Re-export from `BalanceModeToggle` (keep backwards compat for the lifetime of this PR)**

Open `cost-share-app/apps/mobile/components/balances/BalanceModeToggle.tsx`. Replace the line:
```ts
export type BalanceMode = 'paid' | 'spentOn';
```
with:
```ts
export type { BalanceMode } from './balanceMode';
```

- [ ] **Step 3: Switch downstream imports to the new module**

In `cost-share-app/apps/mobile/components/balances/MemberContributionDialog.tsx`, change:
```ts
import type { BalanceMode } from './BalanceModeToggle';
```
to:
```ts
import type { BalanceMode } from './balanceMode';
```

In `cost-share-app/apps/mobile/components/balances/MemberContributionBreakdown.tsx`, change the same import the same way.

- [ ] **Step 4: Typecheck**

From `cost-share-app/apps/mobile`:
```
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Run the dialog tests as a smoke check**

```
npx jest __tests__/components/balances/MemberContributionDialog.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add cost-share-app/apps/mobile/components/balances/balanceMode.ts \
        cost-share-app/apps/mobile/components/balances/BalanceModeToggle.tsx \
        cost-share-app/apps/mobile/components/balances/MemberContributionDialog.tsx \
        cost-share-app/apps/mobile/components/balances/MemberContributionBreakdown.tsx
git commit -m "refactor(balances): move BalanceMode type to its own module"
```

---

## Task 3: Create `GroupTotalsCard` component

The card renders three stats (Total spent / Unsettled / Expenses) inside one rounded white card with hairline dividers, using `CurrencyAmountList` for the currency-aware rows.

**Files:**
- Create: `cost-share-app/apps/mobile/components/balances/GroupTotalsCard.tsx`
- Create: `cost-share-app/apps/mobile/__tests__/components/balances/GroupTotalsCard.test.tsx`
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json`
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json`

- [ ] **Step 1: Add EN i18n keys**

Open `cost-share-app/apps/mobile/i18n/locales/en.json`. Inside the existing `"balances": { ... }` block, after the `"settledUp"` line (around line 393), add:

```json
        "groupTotals": "Group totals",
        "totalSpent": "Total spent",
        "unsettled": "Unsettled",
        "expenseCount_one": "1 expense",
        "expenseCount_other": "{{count}} expenses",
        "membersSectionLabel": "Members",
```

Make sure the previously-last key in `balances` still has a trailing comma if needed; preserve valid JSON. (Run `cat cost-share-app/apps/mobile/i18n/locales/en.json | python3 -m json.tool > /dev/null` to validate; expected: no output, exit code 0.)

- [ ] **Step 2: Add HE i18n keys**

Open `cost-share-app/apps/mobile/i18n/locales/he.json`. Inside the matching `"balances"` block, add the equivalent Hebrew translations in the same position:

```json
        "groupTotals": "סיכום קבוצה",
        "totalSpent": "סה״כ הוצאות",
        "unsettled": "פתוח לסגירה",
        "expenseCount_one": "הוצאה אחת",
        "expenseCount_other": "{{count}} הוצאות",
        "membersSectionLabel": "חברי הקבוצה",
```

Validate JSON: `cat cost-share-app/apps/mobile/i18n/locales/he.json | python3 -m json.tool > /dev/null`.

- [ ] **Step 3: Write failing tests for `GroupTotalsCard`**

Create `cost-share-app/apps/mobile/__tests__/components/balances/GroupTotalsCard.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupTotalsCard } from '../../../components/balances/GroupTotalsCard';

describe('GroupTotalsCard', () => {
    it('renders all three stat labels', () => {
        const { getByText } = render(
            <GroupTotalsCard
                totalSpent={[{ currency: 'USD', amount: 100 }]}
                unsettled={[]}
                expenseCount={1}
                defaultCurrency="USD"
            />,
        );
        expect(getByText('balances.totalSpent')).toBeTruthy();
        expect(getByText('balances.unsettled')).toBeTruthy();
        // Pluralised — singular form.
        expect(getByText('balances.expenseCount_one')).toBeTruthy();
    });

    it('renders one line per currency in total spent', () => {
        const { getByText } = render(
            <GroupTotalsCard
                totalSpent={[
                    { currency: 'USD', amount: 450 },
                    { currency: 'ILS', amount: 1200 },
                ]}
                unsettled={[]}
                expenseCount={5}
                defaultCurrency="USD"
            />,
        );
        expect(getByText('USD 450.00')).toBeTruthy();
        expect(getByText('ILS 1200.00')).toBeTruthy();
    });

    it('shows the empty-state line when unsettled is empty', () => {
        const { getAllByText } = render(
            <GroupTotalsCard
                totalSpent={[{ currency: 'USD', amount: 100 }]}
                unsettled={[]}
                expenseCount={2}
                defaultCurrency="USD"
            />,
        );
        // CurrencyAmountList renders balances.noActivityInMode when amounts is empty.
        expect(getAllByText('balances.noActivityInMode').length).toBeGreaterThanOrEqual(1);
    });

    it('uses the plural expense-count key when count > 1', () => {
        const { getByText } = render(
            <GroupTotalsCard
                totalSpent={[]}
                unsettled={[]}
                expenseCount={5}
                defaultCurrency="USD"
            />,
        );
        expect(getByText('balances.expenseCount_other')).toBeTruthy();
    });

    it('sorts currencies with the group default first', () => {
        const { getAllByText } = render(
            <GroupTotalsCard
                totalSpent={[
                    { currency: 'ILS', amount: 1200 },
                    { currency: 'USD', amount: 450 },
                ]}
                unsettled={[]}
                expenseCount={0}
                defaultCurrency="USD"
            />,
        );
        const matches = getAllByText(/USD 450\.00|ILS 1200\.00/);
        // USD line should appear before ILS line in DOM order.
        expect(matches[0].props.children).toContain('USD 450.00');
    });
});
```

- [ ] **Step 4: Run the test and verify it fails**

```
npx jest __tests__/components/balances/GroupTotalsCard.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `GroupTotalsCard`**

Create `cost-share-app/apps/mobile/components/balances/GroupTotalsCard.tsx`:

```tsx
/**
 * GroupTotalsCard — top of the Balances screen. Three stats:
 *   1. Total spent (per currency)
 *   2. Unsettled (per currency)
 *   3. Expense count — rendered as the pluralised "N expenses" line.
 *
 * Currencies are sorted with the group's default first via
 * sortCurrencyAmounts. The Unsettled row renders the
 * CurrencyAmountList empty-state when nothing is unsettled.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CurrencyAmount, sortCurrencyAmounts } from '@cost-share/shared';
import { Text } from '../AppText';
import { CurrencyAmountList } from './CurrencyAmountList';

interface GroupTotalsCardProps {
    totalSpent: CurrencyAmount[];
    unsettled: CurrencyAmount[];
    expenseCount: number;
    defaultCurrency: string;
}

export function GroupTotalsCard({
    totalSpent,
    unsettled,
    expenseCount,
    defaultCurrency,
}: GroupTotalsCardProps) {
    const { t } = useTranslation();

    const sortedSpent = useMemo(
        () => sortCurrencyAmounts(totalSpent, defaultCurrency),
        [totalSpent, defaultCurrency],
    );
    const sortedUnsettled = useMemo(
        () => sortCurrencyAmounts(unsettled, defaultCurrency),
        [unsettled, defaultCurrency],
    );

    return (
        <View
            className="bg-white rounded-xl px-4 py-3"
            testID="group-totals-card"
        >
            <Text className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                {t('balances.groupTotals')}
            </Text>

            <View className="flex-row items-start justify-between py-2">
                <Text className="text-sm text-gray-600">
                    {t('balances.totalSpent')}
                </Text>
                <View className="items-end">
                    <CurrencyAmountList
                        amounts={sortedSpent}
                        textClassName="text-sm font-semibold text-gray-900"
                    />
                </View>
            </View>

            <View className="h-px bg-slate-100" />

            <View className="flex-row items-start justify-between py-2">
                <Text className="text-sm text-gray-600">
                    {t('balances.unsettled')}
                </Text>
                <View className="items-end">
                    <CurrencyAmountList
                        amounts={sortedUnsettled}
                        textClassName="text-sm font-semibold text-gray-900"
                    />
                </View>
            </View>

            <View className="h-px bg-slate-100" />

            <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-gray-600">
                    {t('balances.expenseCount', { count: expenseCount })}
                </Text>
            </View>
        </View>
    );
}
```

The third row is a single label line (e.g. "5 expenses") with nothing on the right — the pluralised key carries the "expenses" word, so no separate side label is needed.

- [ ] **Step 6: Run the test file**

```
npx jest __tests__/components/balances/GroupTotalsCard.test.tsx
```
Expected: PASS.

If the "sorts currencies" test fails because `getAllByText` order doesn't match, verify that `sortCurrencyAmounts` from `@cost-share/shared` is exported and behaves as in `cost-share-app/packages/shared/src/calculations/groupSummaryStats.ts:37` — default currency first, then alphabetical. The fix is in the test, not the component.

- [ ] **Step 7: Commit**

```
git add cost-share-app/apps/mobile/components/balances/GroupTotalsCard.tsx \
        cost-share-app/apps/mobile/__tests__/components/balances/GroupTotalsCard.test.tsx \
        cost-share-app/apps/mobile/i18n/locales/en.json \
        cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "feat(balances): add GroupTotalsCard for the new top-of-screen summary"
```

---

## Task 4: Restyle `MemberContributionRow` (drop `mode`, dense row look)

**Files:**
- Modify: `cost-share-app/apps/mobile/components/balances/MemberContributionRow.tsx`
- Create: `cost-share-app/apps/mobile/__tests__/components/balances/MemberContributionRow.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `cost-share-app/apps/mobile/__tests__/components/balances/MemberContributionRow.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MemberContributionRow } from '../../../components/balances/MemberContributionRow';

describe('MemberContributionRow', () => {
    it('renders the display name and per-currency paid amounts', () => {
        const { getByText } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                amounts={[
                    { currency: 'USD', amount: 200 },
                    { currency: 'ILS', amount: 50 },
                ]}
                isLast={false}
                onPress={() => {}}
            />,
        );
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('USD 200.00')).toBeTruthy();
        expect(getByText('ILS 50.00')).toBeTruthy();
    });

    it('renders the empty-state line when there are no amounts', () => {
        const { getByText } = render(
            <MemberContributionRow
                userId="bob"
                name="Bob"
                amounts={[]}
                isLast
                onPress={() => {}}
            />,
        );
        expect(getByText('balances.noActivityInMode')).toBeTruthy();
    });

    it('uses the testID member-row-<userId>', () => {
        const { getByTestId } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                amounts={[]}
                isLast
                onPress={() => {}}
            />,
        );
        expect(getByTestId('member-row-alice')).toBeTruthy();
    });

    it('fires onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                amounts={[]}
                isLast
                onPress={onPress}
            />,
        );
        fireEvent.press(getByTestId('member-row-alice'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders the avatar image when avatarUrl is provided', () => {
        const { UNSAFE_getAllByType } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                avatarUrl="https://example.com/alice.png"
                amounts={[]}
                isLast
                onPress={() => {}}
            />,
        );
        const { Image } = require('react-native');
        const images = UNSAFE_getAllByType(Image);
        const matching = images.filter(
            (img: any) => img.props.source?.uri === 'https://example.com/alice.png',
        );
        expect(matching.length).toBe(1);
    });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```
npx jest __tests__/components/balances/MemberContributionRow.test.tsx
```
Expected: FAIL — most likely the existing component still requires the `mode` prop, OR the test cases (`isLast`) aren't part of the existing signature.

- [ ] **Step 3: Rewrite `MemberContributionRow`**

Open `cost-share-app/apps/mobile/components/balances/MemberContributionRow.tsx`. Replace the entire file with:

```tsx
/**
 * MemberContributionRow — one row of the per-member list on the Balances
 * screen. Dense row inside a shared white "Members" card: small avatar,
 * display name (or "You"), and per-currency `paid` amounts on the right.
 * Tapping opens the MemberContributionDialog (handled by the parent).
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CurrencyAmount } from '@cost-share/shared';
import { Text } from '../AppText';
import { MemberAvatar } from '../MemberAvatar';
import { CurrencyAmountList } from './CurrencyAmountList';

interface MemberContributionRowProps {
    userId: string;
    name: string;
    avatarUrl?: string;
    amounts: CurrencyAmount[];
    isCurrentUser?: boolean;
    isLast?: boolean;
    onPress: () => void;
}

export function MemberContributionRow({
    userId,
    name,
    avatarUrl,
    amounts,
    isCurrentUser = false,
    isLast = false,
    onPress,
}: MemberContributionRowProps) {
    const { t } = useTranslation();
    const displayName = isCurrentUser ? t('settleUp.you') : name;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            className={`flex-row items-center px-4 py-3 ${
                isLast ? '' : 'border-b border-slate-100'
            }`}
            testID={`member-row-${userId}`}
        >
            <MemberAvatar name={displayName} avatarUrl={avatarUrl} size="xs" />
            <Text className="flex-1 ml-3 text-sm text-gray-900">
                {displayName}
            </Text>
            <View className="items-end">
                <CurrencyAmountList
                    amounts={amounts}
                    textClassName="text-sm font-semibold text-gray-900"
                />
            </View>
        </TouchableOpacity>
    );
}
```

- [ ] **Step 4: Run the test and verify it passes**

```
npx jest __tests__/components/balances/MemberContributionRow.test.tsx
```
Expected: PASS for all five tests.

If the avatar image test fails because `MemberAvatar` doesn't render an `Image` when `avatarUrl` is set (sanity check it via `cost-share-app/apps/mobile/components/MemberAvatar.tsx`), adapt the test query — for example assert by `testID` on the Image or by `UNSAFE_getByProps`. The component does render `Image` when the URL is non-empty; the test should work as written.

- [ ] **Step 5: Commit**

```
git add cost-share-app/apps/mobile/components/balances/MemberContributionRow.tsx \
        cost-share-app/apps/mobile/__tests__/components/balances/MemberContributionRow.test.tsx
git commit -m "refactor(balances): restyle MemberContributionRow as a dense row"
```

---

## Task 5: Refactor `SimplifiedDebtsSection` to split involved / others with a toggle

**Files:**
- Modify: `cost-share-app/apps/mobile/components/balances/SimplifiedDebtsSection.tsx`
- Create: `cost-share-app/apps/mobile/__tests__/components/balances/SimplifiedDebtsSection.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `cost-share-app/apps/mobile/__tests__/components/balances/SimplifiedDebtsSection.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SimplifiedDebtsSection } from '../../../components/balances/SimplifiedDebtsSection';

const nameById = { me: 'Me', alice: 'Alice', bob: 'Bob', carol: 'Carol' };
const avatarById = { me: undefined, alice: undefined, bob: undefined, carol: undefined };

function entry(currency: string, debts: any[], algorithm: 'exact' | 'greedy' = 'exact') {
    return {
        currency,
        result: { debts, transactionCount: debts.length, algorithm },
    };
}

describe('SimplifiedDebtsSection', () => {
    it('renders the "all settled" empty state when there are no debts', () => {
        const { getByText, queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(getByText('balances.allSettled')).toBeTruthy();
        expect(queryByTestId('debts-summary')).toBeNull();
    });

    it('renders involved debts directly and hides others behind a toggle', () => {
        const involvedDebt = {
            fromUserId: 'me',
            toUserId: 'alice',
            currency: 'USD',
            amount: 30,
        };
        const otherDebt = {
            fromUserId: 'bob',
            toUserId: 'carol',
            currency: 'USD',
            amount: 50,
        };
        const { getByTestId, queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[entry('USD', [involvedDebt, otherDebt])]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        // Involved row is visible immediately.
        expect(getByTestId('settle-debt-me-alice-USD')).toBeTruthy();
        // Non-involved row is hidden until the toggle is pressed.
        expect(queryByTestId('settle-debt-bob-carol-USD')).toBeNull();
        expect(getByTestId('settle-others-toggle')).toBeTruthy();
    });

    it('expands the others list when the toggle is pressed', () => {
        const otherDebt = {
            fromUserId: 'bob',
            toUserId: 'carol',
            currency: 'USD',
            amount: 50,
        };
        const { getByTestId, queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[entry('USD', [otherDebt])]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(queryByTestId('settle-debt-bob-carol-USD')).toBeNull();
        fireEvent.press(getByTestId('settle-others-toggle'));
        expect(getByTestId('settle-debt-bob-carol-USD')).toBeTruthy();
    });

    it('shows the Minimum badge when every currency was solved by the exact algorithm', () => {
        const { getByTestId } = render(
            <SimplifiedDebtsSection
                entries={[
                    entry('USD', [
                        { fromUserId: 'me', toUserId: 'alice', currency: 'USD', amount: 30 },
                    ]),
                ]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(getByTestId('minimum-badge')).toBeTruthy();
    });

    it('hides the Minimum badge when any currency was solved greedily', () => {
        const { queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[
                    entry(
                        'USD',
                        [
                            {
                                fromUserId: 'me',
                                toUserId: 'alice',
                                currency: 'USD',
                                amount: 30,
                            },
                        ],
                        'greedy',
                    ),
                ]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(queryByTestId('minimum-badge')).toBeNull();
    });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```
npx jest __tests__/components/balances/SimplifiedDebtsSection.test.tsx
```
Expected: FAIL — currently the section renders all debts inline, so the "hidden until toggle" assertions and the `settle-others-toggle` lookup will fail.

- [ ] **Step 3: Rewrite `SimplifiedDebtsSection`**

Open `cost-share-app/apps/mobile/components/balances/SimplifiedDebtsSection.tsx`. Replace the whole file with:

```tsx
/**
 * SimplifiedDebtsSection — bottom section of the Balances screen.
 * Reuses the same `DebtRow` as SettleUpListScreen. Debts where the
 * current user is the payer or receiver render directly; the rest are
 * collapsed behind a toggle (same UX as SettleUpListScreen.tsx). The
 * Minimum badge surfaces when every currency was solved exactly, and
 * the "All settled" empty state appears only when every currency
 * simplifies to zero debts.
 */

import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DebtSummary } from '@cost-share/shared';
import { AppIcon } from '../AppIcon';
import { Text } from '../AppText';
import { DebtRow } from './DebtRow';
import type { SimplifiedDebtsByCurrencyEntry } from '../../services/groups.service';
import { colors } from '../../theme';

interface SimplifiedDebtsSectionProps {
    entries: SimplifiedDebtsByCurrencyEntry[];
    avatarById: Record<string, string | undefined>;
    nameById: Record<string, string>;
    currentUserId: string;
    onSettle: (debt: DebtSummary) => void;
}

interface FlatDebt {
    currency: string;
    debt: DebtSummary;
}

export function SimplifiedDebtsSection({
    entries,
    avatarById,
    nameById,
    currentUserId,
    onSettle,
}: SimplifiedDebtsSectionProps) {
    const { t } = useTranslation();
    const [othersExpanded, setOthersExpanded] = useState(false);

    const { totalCount, allExact, involved, others } = useMemo(() => {
        let count = 0;
        let exact = true;
        const inv: FlatDebt[] = [];
        const oth: FlatDebt[] = [];
        for (const e of entries) {
            count += e.result.transactionCount;
            if (e.result.algorithm !== 'exact') exact = false;
            for (const d of e.result.debts) {
                const isMine =
                    d.fromUserId === currentUserId || d.toUserId === currentUserId;
                (isMine ? inv : oth).push({ currency: e.currency, debt: d });
            }
        }
        return { totalCount: count, allExact: exact, involved: inv, others: oth };
    }, [entries, currentUserId]);

    if (involved.length === 0 && others.length === 0) {
        return (
            <View className="bg-green-50 rounded-xl p-6 items-center">
                <Text className="text-base font-medium text-green-700 text-center">
                    {t('balances.allSettled')}
                </Text>
                <Text className="text-sm text-green-600 mt-1 text-center">
                    {t('balances.noDebts')}
                </Text>
            </View>
        );
    }

    const resolveName = (userId: string): string => {
        if (userId === currentUserId) return t('settleUp.you');
        return nameById[userId] ?? t('common.unknown');
    };

    const renderRow = ({ currency, debt }: FlatDebt, involvedRow: boolean) => (
        <DebtRow
            key={`${currency}-${debt.fromUserId}-${debt.toUserId}`}
            debt={debt}
            involved={involvedRow}
            fromName={resolveName(debt.fromUserId)}
            toName={resolveName(debt.toUserId)}
            fromAvatar={avatarById[debt.fromUserId]}
            toAvatar={avatarById[debt.toUserId]}
            onPress={() => onSettle(debt)}
        />
    );

    return (
        <View>
            <View
                testID="debts-summary"
                className="flex-row items-center mb-3"
                style={{ gap: 8 }}
            >
                <Text className="text-sm text-gray-500">
                    {t('balances.paymentsToSettle', { count: totalCount })}
                </Text>
                {allExact && (
                    <View
                        testID="minimum-badge"
                        className="bg-emerald-50 rounded-full px-2 py-0.5"
                    >
                        <Text className="text-xs font-medium text-emerald-700">
                            {t('balances.minimumBadge')}
                        </Text>
                    </View>
                )}
            </View>

            {involved.map(item => renderRow(item, true))}

            {others.length > 0 && (
                <View className={involved.length > 0 ? 'mt-2' : 'mt-0'}>
                    <TouchableOpacity
                        onPress={() => setOthersExpanded(v => !v)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        className="flex-row items-center px-3 py-2.5 rounded-2xl bg-slate-100/70 border border-gray-200"
                        testID="settle-others-toggle"
                    >
                        <AppIcon
                            name={othersExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.gray500}
                        />
                        <Text className="ml-2 flex-1 text-[13px] font-medium text-gray-600">
                            {t('settleUp.othersToggle', { count: others.length })}
                        </Text>
                    </TouchableOpacity>
                    {othersExpanded && (
                        <View className="mt-2">
                            {others.map(item => renderRow(item, false))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```
npx jest __tests__/components/balances/SimplifiedDebtsSection.test.tsx
```
Expected: PASS for all five tests.

- [ ] **Step 5: Commit**

```
git add cost-share-app/apps/mobile/components/balances/SimplifiedDebtsSection.tsx \
        cost-share-app/apps/mobile/__tests__/components/balances/SimplifiedDebtsSection.test.tsx
git commit -m "feat(balances): collapse non-involved debts behind a toggle"
```

---

## Task 6: Refactor `BalancesScreen` to use the new layout

**Files:**
- Modify: `cost-share-app/apps/mobile/screens/balances/BalancesScreen.tsx`
- Modify (rewrite): `cost-share-app/apps/mobile/__tests__/screens/balances/BalancesScreen.test.tsx`

- [ ] **Step 1: Rewrite the screen test for the new layout**

Open `cost-share-app/apps/mobile/__tests__/screens/balances/BalancesScreen.test.tsx`. Replace the contents (everything from `import React from 'react';` to the trailing `});`) with:

```tsx
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
        useRoute: () => ({ params: { groupId: 'g1' } }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../components/SettleUpSheet', () => {
    const React = require('react');
    const { Text, View } = require('react-native');
    return {
        SettleUpSheet: ({ visible, initial }: any) =>
            visible ? (
                <View testID="settle-sheet-open">
                    <Text testID="settle-sheet-from">{initial?.fromUserId ?? ''}</Text>
                    <Text testID="settle-sheet-to">{initial?.toUserId ?? ''}</Text>
                    <Text testID="settle-sheet-currency">{initial?.currency ?? ''}</Text>
                    <Text testID="settle-sheet-amount">{String(initial?.amount ?? '')}</Text>
                </View>
            ) : null,
    };
});

const mockContributionsQuery = jest.fn();
const mockSimplifiedDebtsQuery = jest.fn();
jest.mock('../../../hooks/queries/useGroupBalancesQueries', () => ({
    useGroupContributionsQuery: (...args: any[]) => mockContributionsQuery(...args),
    useGroupSimplifiedDebtsByCurrencyQuery: (...args: any[]) =>
        mockSimplifiedDebtsQuery(...args),
}));

const mockPairwiseQuery = jest.fn();
jest.mock('../../../hooks/queries/useSettlementQueries', () => ({
    useGroupPairwiseDebtsQuery: (...args: any[]) => mockPairwiseQuery(...args),
    useCreateSettlementMutation: () => ({
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isPending: false,
    }),
}));

const mockGroupUsers = jest.fn();
jest.mock('../../../hooks/queries/useGroupUsersQuery', () => ({
    useGroupUsersQuery: (...args: any[]) => mockGroupUsers(...args),
}));

import { BalancesScreen } from '../../../screens/balances/BalancesScreen';
import { useAppStore } from '../../../store';

const members = [
    { id: 'me', name: 'Me', email: 'me@x.com', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), inviteToken: 'me-token' },
    { id: 'alice', name: 'Alice', email: 'a@x.com', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), inviteToken: 'a-token' },
    { id: 'bob', name: 'Bob', email: 'b@x.com', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), inviteToken: 'b-token' },
];

function setContributions(opts: { totals?: any[]; matrix?: any[]; expenseCount?: number }) {
    mockContributionsQuery.mockReturnValue({
        data: {
            totals: opts.totals ?? [],
            matrix: opts.matrix ?? [],
            expenseCount: opts.expenseCount ?? 0,
        },
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
    });
}

function setSimplifiedDebts(entries: any[]) {
    mockSimplifiedDebtsQuery.mockReturnValue({
        data: entries,
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
    });
}

beforeEach(() => {
    mockContributionsQuery.mockReset();
    mockSimplifiedDebtsQuery.mockReset();
    mockPairwiseQuery.mockReset();
    mockGroupUsers.mockReset();
    mockGroupUsers.mockReturnValue({ data: members });
    mockPairwiseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isFetching: false,
        isRefetching: false,
        refetch: jest.fn(),
    });
    useAppStore.setState({
        currentUser: {
            id: 'me',
            email: 'me@x.com',
            name: 'Me',
            defaultCurrency: 'USD',
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            inviteToken: 'me-token',
        } as any,
        groups: [
            {
                id: 'g1',
                name: 'Trip',
                defaultCurrency: 'USD',
                groupType: 'travel',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any,
        ],
    });
});

describe('BalancesScreen', () => {
    it('no longer renders the mode toggle', () => {
        setContributions({});
        setSimplifiedDebts([]);
        const { queryByTestId } = renderWithQuery(<BalancesScreen />);
        expect(queryByTestId('balance-mode-toggle')).toBeNull();
        expect(queryByTestId('balance-mode-toggle-paid')).toBeNull();
        expect(queryByTestId('balance-mode-toggle-spentOn')).toBeNull();
    });

    it('renders the Group Totals card with summed paid amounts and expense count', () => {
        setContributions({
            totals: [
                { userId: 'me', paid: [{ currency: 'USD', amount: 100 }], owed: [] },
                {
                    userId: 'alice',
                    paid: [
                        { currency: 'USD', amount: 50 },
                        { currency: 'ILS', amount: 200 },
                    ],
                    owed: [],
                },
            ],
            expenseCount: 4,
        });
        setSimplifiedDebts([]);
        const { getByTestId, getByText, getAllByText } = renderWithQuery(<BalancesScreen />);
        expect(getByTestId('group-totals-card')).toBeTruthy();
        // USD total is the SUM of paid amounts and appears only in the totals card.
        expect(getByText('USD 150.00')).toBeTruthy();
        // ILS 200 appears both in alice's member row AND the totals card.
        expect(getAllByText('ILS 200.00').length).toBe(2);
        // 4 expenses → uses the plural form key in tests.
        expect(getByText('balances.expenseCount_other')).toBeTruthy();
    });

    it('renders all members with paid amounts (current user first as "You")', () => {
        setContributions({
            totals: [
                { userId: 'alice', paid: [{ currency: 'USD', amount: 50 }], owed: [] },
                { userId: 'bob', paid: [], owed: [] },
                { userId: 'me', paid: [{ currency: 'USD', amount: 100 }], owed: [] },
            ],
            expenseCount: 2,
        });
        setSimplifiedDebts([]);
        const { getByTestId, getAllByText } = renderWithQuery(<BalancesScreen />);
        expect(getByTestId('member-row-me')).toBeTruthy();
        expect(getByTestId('member-row-alice')).toBeTruthy();
        expect(getByTestId('member-row-bob')).toBeTruthy();
        // USD 100 appears in me's row only (USD total = 150, not 100).
        expect(getAllByText('USD 100.00').length).toBe(1);
        // USD 50 appears in alice's row only (USD total = 150).
        expect(getAllByText('USD 50.00').length).toBe(1);
    });

    it('opens MemberContributionDialog when a member row is tapped', () => {
        setContributions({
            totals: [
                {
                    userId: 'me',
                    paid: [{ currency: 'USD', amount: 60 }],
                    owed: [{ currency: 'USD', amount: 20 }],
                },
                { userId: 'alice', paid: [], owed: [{ currency: 'USD', amount: 20 }] },
                { userId: 'bob', paid: [], owed: [{ currency: 'USD', amount: 20 }] },
            ],
            matrix: [
                { payerId: 'me', consumerId: 'me', currency: 'USD', amount: 20 },
                { payerId: 'me', consumerId: 'alice', currency: 'USD', amount: 20 },
                { payerId: 'me', consumerId: 'bob', currency: 'USD', amount: 20 },
            ],
            expenseCount: 1,
        });
        setSimplifiedDebts([]);
        const { getByTestId } = renderWithQuery(<BalancesScreen />);
        fireEvent.press(getByTestId('member-row-me'));
        expect(getByTestId('contribution-section-alice')).toBeTruthy();
        expect(getByTestId('contribution-section-bob')).toBeTruthy();
    });

    it('renders the simplified-debts section with the Minimum badge when all-exact', () => {
        setContributions({});
        setSimplifiedDebts([
            {
                currency: 'USD',
                result: {
                    debts: [
                        {
                            fromUserId: 'alice',
                            fromUserName: 'Alice',
                            toUserId: 'me',
                            toUserName: 'Me',
                            amount: 25,
                            currency: 'USD',
                        },
                    ],
                    transactionCount: 1,
                    algorithm: 'exact',
                },
            },
        ]);
        const { getByText, getByTestId } = renderWithQuery(<BalancesScreen />);
        expect(getByText('USD 25.00')).toBeTruthy();
        expect(getByTestId('minimum-badge')).toBeTruthy();
    });

    it('collapses non-involved debts behind a toggle and expands on press', () => {
        setContributions({});
        setSimplifiedDebts([
            {
                currency: 'USD',
                result: {
                    debts: [
                        // involved
                        {
                            fromUserId: 'me',
                            fromUserName: 'Me',
                            toUserId: 'alice',
                            toUserName: 'Alice',
                            amount: 30,
                            currency: 'USD',
                        },
                        // not involved
                        {
                            fromUserId: 'alice',
                            fromUserName: 'Alice',
                            toUserId: 'bob',
                            toUserName: 'Bob',
                            amount: 50,
                            currency: 'USD',
                        },
                    ],
                    transactionCount: 2,
                    algorithm: 'exact',
                },
            },
        ]);
        const { getByTestId, queryByTestId } = renderWithQuery(<BalancesScreen />);
        expect(getByTestId('settle-debt-me-alice-USD')).toBeTruthy();
        expect(queryByTestId('settle-debt-alice-bob-USD')).toBeNull();
        fireEvent.press(getByTestId('settle-others-toggle'));
        expect(getByTestId('settle-debt-alice-bob-USD')).toBeTruthy();
    });

    it('shows the "all settled" empty state when no currency has debts', () => {
        setContributions({});
        setSimplifiedDebts([]);
        const { getByText, queryByTestId } = renderWithQuery(<BalancesScreen />);
        expect(getByText('balances.allSettled')).toBeTruthy();
        expect(queryByTestId('debts-summary')).toBeNull();
    });

    it('opens SettleUpSheet pre-filled with the tapped simplified-debt row', () => {
        setContributions({});
        setSimplifiedDebts([
            {
                currency: 'USD',
                result: {
                    debts: [
                        {
                            fromUserId: 'alice',
                            fromUserName: 'Alice',
                            toUserId: 'me',
                            toUserName: 'Me',
                            amount: 25,
                            currency: 'USD',
                        },
                    ],
                    transactionCount: 1,
                    algorithm: 'exact',
                },
            },
        ]);
        const { getByTestId } = renderWithQuery(<BalancesScreen />);
        fireEvent.press(getByTestId('settle-debt-alice-me-USD'));
        expect(getByTestId('settle-sheet-open')).toBeTruthy();
        expect(getByTestId('settle-sheet-from').props.children).toBe('alice');
        expect(getByTestId('settle-sheet-to').props.children).toBe('me');
        expect(getByTestId('settle-sheet-currency').props.children).toBe('USD');
        expect(getByTestId('settle-sheet-amount').props.children).toBe('25');
    });
});
```

- [ ] **Step 2: Run the tests and confirm failures (mostly on the new toggle / totals / no-toggle assertions)**

```
npx jest __tests__/screens/balances/BalancesScreen.test.tsx
```
Expected: FAIL on the new assertions (`group-totals-card` missing, mode-toggle still present, etc.) — old assertions removed.

- [ ] **Step 3: Refactor `BalancesScreen.tsx`**

Open `cost-share-app/apps/mobile/screens/balances/BalancesScreen.tsx`. Replace the entire file with:

```tsx
/**
 * BalancesScreen
 *
 * Top-level layout (top → bottom):
 *   • GroupTotalsCard — total spent / unsettled / expense count.
 *   • Members card — one row per group member, paid per currency.
 *     Tapping a row opens MemberContributionDialog (unchanged).
 *   • SimplifiedDebtsSection — per-currency runs of simplifyDebts.
 *     Debts that don't involve the current user are collapsed behind
 *     a toggle (mirrors SettleUpListScreen).
 *
 * Multi-currency-aware throughout; amounts are never silently
 * collapsed across currencies.
 */

import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    CurrencyAmount,
    DebtSummary,
    GroupMemberLite,
    PairwiseDebt,
    calculateGroupTotalUnsettled,
} from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { SettleUpSheet, SettleUpFormValues } from '../../components/SettleUpSheet';
import { GroupTotalsCard } from '../../components/balances/GroupTotalsCard';
import { MemberContributionRow } from '../../components/balances/MemberContributionRow';
import { MemberContributionDialog } from '../../components/balances/MemberContributionDialog';
import { SimplifiedDebtsSection } from '../../components/balances/SimplifiedDebtsSection';
import { useGroupUsersQuery } from '../../hooks/queries/useGroupUsersQuery';
import {
    useGroupContributionsQuery,
    useGroupSimplifiedDebtsByCurrencyQuery,
} from '../../hooks/queries/useGroupBalancesQueries';
import {
    useCreateSettlementMutation,
    useGroupPairwiseDebtsQuery,
} from '../../hooks/queries/useSettlementQueries';
import { useAppStore } from '../../store';
import { colors } from '../../theme';
import { getAvatarUrl, getDisplayName } from '../../lib/userDisplay';

interface SettleTarget {
    fromUserId: string;
    toUserId: string;
    currency: string;
    amount: number;
}

function sumPaidByCurrency(
    totals: { paid: CurrencyAmount[] }[],
): CurrencyAmount[] {
    const acc = new Map<string, number>();
    for (const t of totals) {
        for (const row of t.paid) {
            acc.set(row.currency, (acc.get(row.currency) ?? 0) + row.amount);
        }
    }
    return Array.from(acc.entries())
        .map(([currency, amount]) => ({
            currency,
            amount: Number(amount.toFixed(2)),
        }))
        .filter(row => row.amount >= 0.01);
}

export function BalancesScreen() {
    const { t } = useTranslation();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { groupId } = route.params;
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const group = useAppStore(s => s.groups.find(g => g.id === groupId));
    const groupName = group?.name;
    const defaultCurrency = group?.defaultCurrency ?? 'USD';

    useLayoutEffect(() => {
        if (groupName) {
            navigation.setOptions({ title: groupName });
        }
    }, [navigation, groupName]);

    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);

    const { data: allUsers = [] } = useGroupUsersQuery(groupId);
    const {
        data: contributions,
        isLoading: isLoadingContributions,
        isFetching: isFetchingContributions,
        refetch: refetchContributions,
    } = useGroupContributionsQuery(groupId);
    const {
        data: simplifiedByCurrency,
        isLoading: isLoadingDebts,
        isFetching: isFetchingDebts,
        refetch: refetchDebts,
    } = useGroupSimplifiedDebtsByCurrencyQuery(groupId);
    const { data: pairwiseDebts = [], refetch: refetchPairwise } =
        useGroupPairwiseDebtsQuery(groupId);
    const createMutation = useCreateSettlementMutation(groupId);

    const members: GroupMemberLite[] = useMemo(
        () =>
            allUsers.map(u => ({
                userId: u.id,
                displayName: getDisplayName(u, t),
                avatarUrl: getAvatarUrl(u) ?? undefined,
                isActive: u.isActive,
            })),
        [allUsers, t],
    );

    const avatarById: Record<string, string | undefined> = useMemo(() => {
        const map: Record<string, string | undefined> = {};
        for (const m of members) map[m.userId] = m.avatarUrl;
        return map;
    }, [members]);

    const nameById: Record<string, string> = useMemo(() => {
        const map: Record<string, string> = {};
        for (const m of members) map[m.userId] = m.displayName;
        return map;
    }, [members]);

    const sortedMembers = useMemo(() => {
        const sorted = [...members];
        sorted.sort((a, b) => {
            if (a.userId === currentUserId) return -1;
            if (b.userId === currentUserId) return 1;
            return a.displayName.localeCompare(b.displayName);
        });
        return sorted;
    }, [members, currentUserId]);

    const totalsByUser = useMemo(() => {
        const map = new Map<string, { paid: CurrencyAmount[]; owed: CurrencyAmount[] }>();
        for (const row of contributions?.totals ?? []) {
            map.set(row.userId, { paid: row.paid, owed: row.owed });
        }
        return map;
    }, [contributions]);

    const totalSpent: CurrencyAmount[] = useMemo(
        () => sumPaidByCurrency(contributions?.totals ?? []),
        [contributions],
    );

    const unsettledTotal: CurrencyAmount[] = useMemo(() => {
        const flat: PairwiseDebt[] =
            simplifiedByCurrency?.flatMap(e =>
                e.result.debts.map(d => ({
                    fromUserId: d.fromUserId,
                    toUserId: d.toUserId,
                    currency: d.currency,
                    amount: d.amount,
                })),
            ) ?? [];
        return calculateGroupTotalUnsettled(flat);
    }, [simplifiedByCurrency]);

    const expenseCount = contributions?.expenseCount ?? 0;

    const paidForUser = useCallback(
        (userId: string): CurrencyAmount[] => {
            return totalsByUser.get(userId)?.paid ?? [];
        },
        [totalsByUser],
    );

    const handleMemberPress = useCallback((userId: string) => {
        setSelectedMemberId(userId);
    }, []);

    const handleSettle = useCallback((debt: DebtSummary) => {
        setSettleTarget({
            fromUserId: debt.fromUserId,
            toUserId: debt.toUserId,
            currency: debt.currency,
            amount: debt.amount,
        });
    }, []);

    const handleSubmitSettlement = useCallback(
        async (values: SettleUpFormValues) => {
            await createMutation.mutateAsync({
                groupId,
                fromUserId: values.fromUserId,
                toUserId: values.toUserId,
                amount: values.amount,
                currency: values.currency,
                paymentMethod: values.paymentMethod,
                settlementDate: values.settlementDate,
            });
            setSettleTarget(null);
        },
        [createMutation, groupId],
    );

    const handleRefresh = useCallback(async () => {
        await Promise.all([
            refetchContributions(),
            refetchDebts(),
            refetchPairwise(),
        ]);
    }, [refetchContributions, refetchDebts, refetchPairwise]);

    const selectedMember =
        selectedMemberId != null
            ? members.find(m => m.userId === selectedMemberId) ?? null
            : null;

    const dialogSelfTotals: CurrencyAmount[] = useMemo(() => {
        if (!selectedMemberId) return [];
        return paidForUser(selectedMemberId);
    }, [selectedMemberId, paidForUser]);

    const pairwiseDebtsForSettle: PairwiseDebt[] = useMemo(() => {
        if (!settleTarget) return pairwiseDebts;
        const seed: PairwiseDebt = {
            fromUserId: settleTarget.fromUserId,
            toUserId: settleTarget.toUserId,
            currency: settleTarget.currency,
            amount: settleTarget.amount,
        };
        const exists = pairwiseDebts.some(
            d =>
                d.fromUserId === seed.fromUserId &&
                d.toUserId === seed.toUserId &&
                d.currency === seed.currency,
        );
        return exists ? pairwiseDebts : [seed, ...pairwiseDebts];
    }, [pairwiseDebts, settleTarget]);

    if (
        (isLoadingContributions && !contributions) ||
        (isLoadingDebts && !simplifiedByCurrency)
    ) {
        return <LoadingIndicator />;
    }

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={isFetchingContributions || isFetchingDebts}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                <View className="px-4 pt-4">
                    <GroupTotalsCard
                        totalSpent={totalSpent}
                        unsettled={unsettledTotal}
                        expenseCount={expenseCount}
                        defaultCurrency={defaultCurrency}
                    />
                </View>

                <View className="px-4 pt-4">
                    <Text className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                        {t('balances.membersSectionLabel')}
                    </Text>
                    <View className="bg-white rounded-xl overflow-hidden">
                        {sortedMembers.map((member, idx) => (
                            <MemberContributionRow
                                key={member.userId}
                                userId={member.userId}
                                name={member.displayName}
                                avatarUrl={member.avatarUrl}
                                amounts={paidForUser(member.userId)}
                                isCurrentUser={member.userId === currentUserId}
                                isLast={idx === sortedMembers.length - 1}
                                onPress={() => handleMemberPress(member.userId)}
                            />
                        ))}
                    </View>
                </View>

                <View className="px-4 pt-4 pb-8">
                    <Text className="text-lg font-semibold text-gray-900 mb-1">
                        {t('balances.simplifiedDebts')}
                    </Text>
                    <SimplifiedDebtsSection
                        entries={simplifiedByCurrency ?? []}
                        avatarById={avatarById}
                        nameById={nameById}
                        currentUserId={currentUserId}
                        onSettle={handleSettle}
                    />
                </View>
            </ScrollView>

            <MemberContributionDialog
                open={selectedMember !== null}
                member={selectedMember}
                allMembers={sortedMembers}
                matrix={contributions?.matrix ?? []}
                selfTotals={dialogSelfTotals}
                mode="paid"
                currentUserId={currentUserId}
                onClose={() => setSelectedMemberId(null)}
            />

            {settleTarget && currentUserId && (
                <SettleUpSheet
                    visible={Boolean(settleTarget)}
                    members={members}
                    pairwiseDebts={pairwiseDebtsForSettle}
                    currentUserId={currentUserId}
                    initial={settleTarget}
                    mode="create"
                    submitting={createMutation.isPending}
                    onSubmit={handleSubmitSettlement}
                    onClose={() => setSettleTarget(null)}
                />
            )}
        </View>
    );
}
```

- [ ] **Step 4: Run the screen tests and verify they pass**

```
npx jest __tests__/screens/balances/BalancesScreen.test.tsx
```
Expected: PASS for all eight tests.

- [ ] **Step 5: Run the whole balances test directory**

```
npx jest __tests__/components/balances __tests__/screens/balances __tests__/shared/memberContributions.test.ts
```
Expected: PASS across all files.

- [ ] **Step 6: Typecheck**

```
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 7: Commit**

```
git add cost-share-app/apps/mobile/screens/balances/BalancesScreen.tsx \
        cost-share-app/apps/mobile/__tests__/screens/balances/BalancesScreen.test.tsx
git commit -m "refactor(balances): adopt totals card + dense members list + collapsible others"
```

---

## Task 7: Delete `BalanceModeToggle` and prune unused i18n keys

**Files:**
- Delete: `cost-share-app/apps/mobile/components/balances/BalanceModeToggle.tsx`
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json`
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json`

- [ ] **Step 1: Verify nothing imports `BalanceModeToggle` anymore**

Run from the repo root:
```
grep -rn "BalanceModeToggle" cost-share-app --include='*.ts' --include='*.tsx'
```
Expected: only the file itself appears. If any other file still imports it, fix that file before continuing.

- [ ] **Step 2: Verify the mode i18n keys are no longer referenced from code**

```
grep -rn "balances\.modeToggle\|balances\.paidMode\.row\|balances\.spentOnMode\.row" \
    cost-share-app --include='*.ts' --include='*.tsx'
```
Expected: zero matches in `.ts`/`.tsx` (the strings should now only live in the JSON locale files).

If something still references one of these keys, leave that key alone and SKIP its removal in Step 4.

- [ ] **Step 3: Delete `BalanceModeToggle.tsx`**

```
git rm cost-share-app/apps/mobile/components/balances/BalanceModeToggle.tsx
```

- [ ] **Step 4: Remove unreferenced i18n keys from EN**

Open `cost-share-app/apps/mobile/i18n/locales/en.json`. Inside the `"balances": { ... }` object, remove the following blocks (only if Step 2 confirmed zero `.ts`/`.tsx` matches for them):

```json
        "modeToggle": {
            "paid": "Paid",
            "spentOn": "Spent on"
        },
```

In `paidMode`, remove `"row"` and `"rowYou"` keys; **keep** `"detailSection"` and `"detailSectionYou"` (still used by `MemberContributionBreakdown`).
In `spentOnMode`, remove `"row"` and `"rowYou"`; **keep** `"detailSection"`, `"detailSectionNameYou"`, `"detailSectionOwnerYou"`.

After editing, validate JSON:
```
cat cost-share-app/apps/mobile/i18n/locales/en.json | python3 -m json.tool > /dev/null
```
Expected: exit code 0.

- [ ] **Step 5: Mirror the removals in HE**

Open `cost-share-app/apps/mobile/i18n/locales/he.json` and apply the same removals: delete `modeToggle`, delete `paidMode.row` + `paidMode.rowYou`, delete `spentOnMode.row` + `spentOnMode.rowYou`. Keep all `detailSection*` keys.

Validate:
```
cat cost-share-app/apps/mobile/i18n/locales/he.json | python3 -m json.tool > /dev/null
```
Expected: exit code 0.

- [ ] **Step 6: Run the whole balances + shared test suite once more**

```
npx jest __tests__/components/balances __tests__/screens/balances __tests__/shared/memberContributions.test.ts
```
Expected: PASS across the board.

- [ ] **Step 7: Typecheck**

```
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 8: Final guard — full test suite**

From `cost-share-app/apps/mobile`:
```
npx jest
```
Expected: PASS for the whole project. If any unrelated test fails, do not edit it as part of this plan — surface the failure to the user.

- [ ] **Step 9: Commit**

```
git add cost-share-app/apps/mobile/components/balances/BalanceModeToggle.tsx \
        cost-share-app/apps/mobile/i18n/locales/en.json \
        cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "chore(balances): remove BalanceModeToggle and unused mode i18n keys"
```

---

## Self-Review Notes (for the executor)

If during execution any test fails for a reason unrelated to the described expectation:

1. Re-read the failing test message carefully — many balances tests rely on `i18next` returning the key string in tests (e.g. `balances.expenseCount_one` instead of "1 expense"). If that's the cause, prefer matching on the key string in tests.
2. The `useFocusEffect` mock in `BalancesScreen.test.tsx` exists because the screen's `useLayoutEffect` runs `navigation.setOptions`. If `setOptions` becomes required for other reasons, ensure the mock in Step 1 of Task 6 exposes it (it does: `setOptions: jest.fn()`).
3. If `MemberAvatar` fails to render an `Image` in the row test (Task 4 Step 1), inspect `cost-share-app/apps/mobile/components/MemberAvatar.tsx:38` to find the exact prop layering and adjust the query — don't change the component.
