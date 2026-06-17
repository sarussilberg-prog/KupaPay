# Canonical simplifier — one source of truth for balances

**Status:** Approved (design phase) — 2026-06-17
**Owner:** Avraham
**Supersedes:** the dev-only migration `20260617120000_balance_summary_per_currency.sql` (chip-stack + others fields). That patch corrected `get_user_balance_summary.byGroup` but left two other RPCs (`get_user_dashboard`, `get_group_pairwise_debts`) producing pair-level numbers that disagree with the settle-up screen.

## Problem

Four UI surfaces show balance numbers, and they disagree with each other on the same ledger:

1. **Group header strip** ("You have ILS 14.68 to your credit")
2. **Groups list chip** ("+ILS 14.68")
3. **Profile-screen friend tile** ("Bar Hemo owes you $3.33")
4. **Per-group breakdown sheet** ("Blala — 7.33 IRR")

The settle-up screen, which runs the simplifier per `(group, currency)`, is the only surface that produces operationally correct numbers. The other four read from three different SQL RPCs that all do **pair-level** math (`pair_net` CTE), then pick or aggregate residuals that the simplifier would have cancelled. Examples observed in prod:

- **Cycle masking** — Blala IRR: Ari→Bar 7.33, Bar→Naveh 7.33, Naveh→Ari 7.33. Every per-user net is 0; the settle-up screen says "everyone settled"; the friend tile says "Ari owes Bar 7.33 IRR".
- **Cherry-picked pair** — Paris ILS: Sarus is owed 14.68 by Ari and 14.66 by Naveh (29.34 total). Header showed "+ILS 14.68" (the larger pair).
- **Combined-currencies drift** — the friend tile's "combined currencies" total uses raw pair-nets; per-currency rows shown in the breakdown sheet don't add up to it because they're computed by yet another RPC.

These are not separate bugs. They are the same root cause repeated across three RPCs, with no structural guarantee that any of them stays in sync.

## Goal

Make `simplifyDebts` the canonical definition of what a "debt" is. Every UI surface that shows a balance number derives from one struct produced by one pure function. Two surfaces disagreeing becomes a bug in that one function, not a class of "different RPC" mismatches that recur after every change.

Concretely:

- Settle-up screen, group header, list chip, friend tile, breakdown sheet all read from the same in-memory object.
- That object is produced by `simplifyDebts` running per `(group, currency)`.
- Property-based tests prove the invariant: for any random ledger, every surface's numbers agree with the canonical transfer list.

## Non-goals

- Replacing the simplifier algorithm. The existing `simplifyDebts` (exact ≤10 nonzero, greedy otherwise) stays.
- Changing FX behaviour. Conversion to a display currency stays at the rendering layer.
- Server-side simplifier (in plpgsql). Considered and rejected — too hard to keep in lockstep with the TS version; backtracking in plpgsql is painful to maintain.
- Integration tests against a seeded Supabase. Considered and rejected for this spec — property-based tests on the pure derivation prove the invariants without a DB harness.

## Architecture

### Server (Postgres)

One RPC replaces three:

```sql
get_user_simplified_inputs(p_user_id UUID) RETURNS JSONB
```

Returns, for every active group the user is in:

```json
{
  "groups": [
    {
      "groupId": "...",
      "members": [
        {"userId": "...", "name": "...", "avatarUrl": "..."}
      ],
      "currencies": [
        {
          "currency": "IRR",
          "nets": [
            {"userId": "u_ari", "net": -7.33},
            {"userId": "u_bar", "net":  7.33}
          ]
        }
      ]
    }
  ]
}
```

Math is pure SQL aggregation per `(group, currency, user)`:

```
net = paid − owed + settledPaid − settledReceived
```

No `pair_net`, no `DISTINCT ON`, no simplifier. Currencies with all-zero nets are omitted; groups with no nonzero currencies are omitted. The function is `SECURITY DEFINER` (matches the other balance RPCs) and grants `EXECUTE` to `authenticated`.

### Shared TypeScript (single source of truth)

New module: `packages/shared/src/calculations/simplifiedDebtsModel.ts`. Pure functions, no React, no Supabase.

```ts
export type Transfer = {
  groupId: string;
  currency: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type GroupRollup = {
  primary: { currency: string; net: number };
  others: { currency: string; net: number }[];
};

export type FriendBalance = {
  byCurrency: { currency: string; net: number }[];
  sharedGroupIds: string[];
  name: string;
  avatarUrl?: string;
  isActive: boolean;
};

export type SimplifiedDebts = {
  /** Canonical list. Every other field is a view onto this list. */
  transfers: Transfer[];

  /** Settle-up screen, breakdown sheet. */
  byGroupCurrency: Map<string, Map<string, Transfer[]>>;

  /** Transfers where currentUser is fromUserId or toUserId. */
  userTransfers: Transfer[];

  /** Header + list chip. Per-currency net for current user in each group. */
  groupRollups: Map<string, GroupRollup>;

  /** Profile friend tile. Per-currency net with each counterparty across all groups. */
  friendBalances: Map<string, FriendBalance>;
};

export function deriveSimplifiedDebts(
  payload: SimplifiedInputsPayload,
  currentUserId: string,
): SimplifiedDebts;
```

`deriveSimplifiedDebts`:

1. For each group, for each currency: run the existing `simplifyDebts(nets)` to produce a list of `Transfer`.
2. Concatenate all transfers into `transfers`.
3. Build the four views from `transfers` and the currentUser id. Each view is a pure projection — no recalculation from raw nets.

### Mobile

One hook:

```ts
// apps/mobile/hooks/useSimplifiedDebts.ts
export function useSimplifiedDebts(): {
  data: SimplifiedDebts | undefined;
  isLoading: boolean;
  isError: boolean;
};
```

- Uses React Query against `fetchSimplifiedInputs()` (new thin wrapper in `services/simplifiedDebts.service.ts`).
- Calls `deriveSimplifiedDebts(payload, currentUserId)` inside a `useMemo` keyed on payload + userId.
- Reuses the existing invalidation helper (`invalidateGroupDerivedCaches`, renamed to `invalidateBalanceCaches`) — every expense/settlement mutation already calls it.
- Realtime subscriptions on `expenses` and `settlements` continue to call the same helper.

Zustand store loses `balanceSummary`, `groupBalances`, and `setBalanceSummary`. Persisted state shrinks; cold-start consistency improves (one source).

## Data flow

```
Postgres (expenses, expense_splits, settlements, group_members, profiles)
  │
  ▼  get_user_simplified_inputs(p_user_id)  — per-(group, currency, user) nets
  │
  ▼  fetchSimplifiedInputs() → React Query cache
  │
  ▼  deriveSimplifiedDebts(payload, currentUserId)  — runs simplifyDebts per (group, currency)
  │
  ▼  SimplifiedDebts struct
  │
  ├─▶ GroupsListScreen / GroupCard chip          ← groupRollups
  ├─▶ SummaryBalanceStrip (group header)         ← groupRollups
  ├─▶ ProfileScreen friend tiles                 ← friendBalances
  ├─▶ FriendGroupBalancesSheet (drilldown)       ← byGroupCurrency, filtered to user ↔ friend
  └─▶ SettleUpListScreen                         ← byGroupCurrency
```

There is no other path to a balance number on screen.

## Migration plan

Single PR, no half-state. Migrate every consumer before the SQL change to the new RPC lands behind, then drop the old RPCs:

1. Add `get_user_simplified_inputs` SQL migration (additive).
2. Add `simplifiedDebtsModel.ts`, tests, hook, service.
3. Migrate every consumer surface in the same PR.
4. Delete `get_user_balance_summary`, `get_user_dashboard`, `get_group_pairwise_debts` in a final migration in the same PR.
5. Tests must pass at every commit boundary (CI guard).

The chip-stack/`others` migration already applied to dev (`20260617120000_balance_summary_per_currency.sql`) is superseded by this work. It stays in dev as a stepping-stone; prod skips it and goes directly to the new RPC.

## File plan

### New

| Path | Purpose |
|---|---|
| `supabase/migrations/20260618xxxxxx_simplified_inputs_rpc.sql` | Create `get_user_simplified_inputs`; drop the three old RPCs |
| `packages/shared/src/calculations/simplifiedDebtsModel.ts` | `deriveSimplifiedDebts`, `SimplifiedDebts`, `Transfer` |
| `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts` | Golden-fixture tests |
| `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.property.test.ts` | Property-based tests (`fast-check`) |
| `apps/mobile/hooks/useSimplifiedDebts.ts` | React Query wrapper + memoized derivation |
| `apps/mobile/services/simplifiedDebts.service.ts` | `fetchSimplifiedInputs()` RPC wrapper |

### Modified

| Path | Change |
|---|---|
| `packages/shared/src/types/index.ts` | Drop `GroupBalance`, `BalanceSummary*`, `FriendBalance*`, `UserDashboard`; add `SimplifiedInputsPayload` |
| `packages/shared/src/calculations/index.ts` | Re-export new module; drop `friendBalanceDisplay`; keep `resolveGroupBalanceDisplayBundle` (FX layer consumes the new struct) |
| `apps/mobile/store/index.ts` | Drop balance fields and setter |
| `apps/mobile/services/users.service.ts` | Drop `fetchBalanceSummary` |
| `apps/mobile/services/settlements.service.ts` | Drop `fetchGroupPairwiseDebts` |
| `apps/mobile/hooks/queries/useGroupBalancesQueries.ts` | Drop `useGroupSimplifiedDebtsByCurrencyQuery` (subsumed) |
| `apps/mobile/hooks/queries/useSettlementQueries.ts` | Drop `useGroupPairwiseDebtsQuery`; rewire invalidator |
| `apps/mobile/lib/invalidateGroupDerivedCaches.ts` | Rename to `invalidateBalanceCaches`; point at new query key; drop dashboard/balance-summary refetches |
| `apps/mobile/hooks/useGroupBalancesDisplay.ts` | Thin selector over `useSimplifiedDebts` (FX still resolved here) |
| `apps/mobile/hooks/useFriendBalancesDisplay.ts` | Same |
| `apps/mobile/components/BalanceChip.tsx` | Consumes `groupRollups` entry |
| `apps/mobile/components/groupDetail/SummaryBalanceStrip.tsx` | Same |
| `apps/mobile/components/GroupCard.tsx` | Same |
| `apps/mobile/components/dashboard/FriendGroupBalancesSheet.tsx` | Reads from `byGroupCurrency`, filters to user↔friend transfers |
| `apps/mobile/screens/groups/GroupDetailScreen.tsx` | Use hook, drop store reads |
| `apps/mobile/screens/groups/GroupsListScreen.tsx` | Same |
| `apps/mobile/screens/profile/ProfileScreen.tsx` | Same |
| `apps/mobile/screens/balances/SettleUpListScreen.tsx` | Reads `byGroupCurrency` instead of the dedicated query |
| `supabase/schema.sql` | Replace old RPC defs with new one; drop deleted RPCs |

### Deleted

- `packages/shared/src/calculations/friendBalanceDisplay.ts` — superseded
- `apps/mobile/hooks/queries/useGroupBalancesQueries.ts` — folded into `useSimplifiedDebts`

## Tests

### Layer 1 — Pure-function golden fixtures

Location: `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts`

Each fixture is a literal `SimplifiedInputsPayload` (no DB, no mocks). The test calls `deriveSimplifiedDebts(payload, currentUserId)` and asserts every derivation matches a hand-computed expected value.

| Fixture | What it covers |
|---|---|
| `cycle_blala` | 3 members, IRR perfect cycle. Simplification cancels; every surface settled |
| `residual_paris` | 3 members, ILS, Sarus paid 44 split 14.66/14.68/14.66. Header rolls up to +29.34 (not 14.68) |
| `multi_currency_blala_full` | 3 members, IRR cycle + USD residual + AUD round-trip settlements. Primary-vs-others; FX-neutral aggregation |
| `all_settled` | 3 members, expense + matching settlements. Group omitted from rollups + friendBalances |
| `settlements_only` | No expenses, just round-trip settlements. Non-zero settledPaid/Received don't surface phantom debts |
| `deleted_excluded` | Deleted expense + deleted settlement absent from RPC payload — model trusts the server's filter (backstop) |
| `multi_group` | 2 groups, same friend in both, mixed currencies. `friendBalances` sums correctly across groups |

Each fixture asserts the consistency invariants in one block:

```ts
it('cycle_blala — all surfaces agree', () => {
  const d = deriveSimplifiedDebts(cycle_blala, ARI);
  expect(d.transfers).toEqual([]);
  expect(d.groupRollups.get(BLALA)).toBeUndefined();
  expect(d.userTransfers).toEqual([]);
  expect(d.friendBalances.get(BAR)).toBeUndefined();
  expect(d.byGroupCurrency.get(BLALA)).toBeUndefined();
});
```

### Layer 2 — Property-based

Location: `simplifiedDebtsModel.property.test.ts`. Uses `fast-check`.

Generators:
- `arbGroupLedger`: 2–6 members, 0–20 expenses (random payer, equal-or-unequal split, currency from a fixed set), 0–10 settlements.
- `arbPayload`: 1–4 groups, `currentUserId` always present.

Invariants asserted for every random payload:

| # | Invariant | What it catches |
|---|---|---|
| 1 | `Σ transfers per (group, currency) involving currentUser == groupRollups[group] primary+others summed` | Header total = sum of canonical transfers |
| 2 | `Σ transfers where currentUser is from-or-to, grouped by (friend, currency) == friendBalances[friend].byCurrency` | Friend tile total = sum of canonical user-transfers |
| 3 | `Σ byGroupCurrency[group][cur] where pair is (currentUser, friend) == friendBalances[friend].byCurrency[cur] restricted to that group` | Breakdown sheet row = slice of canonical |
| 4 | `simplifyDebts produces minimal transfer count for ≤10 nonzero balances (exact)` | Algorithm guarantee preserved |
| 5 | `Σ all net balances per (group, currency) == 0 (±1 cent tolerance)` | Ledger always balances |
| 6 | `Every transfer.amount > 0; fromUserId ≠ toUserId` | Sanity |

When `fast-check` finds a counterexample it shrinks to the minimal failing ledger, giving us a reproducible fixture for free.

### Layer 3 — Existing tests updated

- `BalanceChip.test.tsx`, `GroupCard.test.tsx`, `SummaryBalanceStrip.test.tsx` — update to consume `groupRollups` shape (interface change only).
- `SimplifiedDebtsSection.test.tsx`, `BalancesScreen.test.tsx` — update to consume canonical.
- `groupBalanceDisplay.test.ts` — delete (functionality moves to `simplifiedDebtsModel.test.ts`).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Big PR; reviewers can't hold it all in head | Sequenced commits within the PR (RPC → shared model → tests → hook → surfaces → drop old RPCs). Each commit ships type-check + tests passing. |
| Half-migrated state in prod if PR partially deploys | Atomic deploy: server RPC migration runs first (new RPC available); client switches over; final migration drops old RPCs only after a verification window. Each step is independently reversible. |
| Performance: simplifier runs per (group, currency) per fetch | Mitigated: exact backtracking is bounded to ≤10 nonzero balances; greedy after that. Typical group is 2–5 members per currency. Memoised inside the hook. |
| FX rendering regressions | FX layer untouched; consumes the new struct unchanged. Existing FX tests stay. |
| Realtime cache misses keep showing stale numbers | One invalidation helper (`invalidateBalanceCaches`) covers all consumers — no more "did we invalidate query X too?" forgetting one. |
| Property tests are flaky | `fast-check` runs with a fixed seed in CI; shrunken counterexamples become permanent fixtures. |

## Out of scope (follow-ups)

- Web app surfaces. Mobile-first; web will adopt the same hook in a follow-up PR.
- Admin / CSV export that reads pair-level data. If any consumer remains after audit, it gets migrated in the same PR; otherwise tracked separately.
- A `useSimplifiedDebtsForGroup(groupId)` selector. The hook already returns the full struct; surfaces filter. If a hot path emerges, add a memoised selector then.
