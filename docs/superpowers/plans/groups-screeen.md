# Groups list screen — canonical UI (mockup B2)

**Status:** Canonical as shipped on `dev` (approved in #616; product pick from #486, layout refinements in #635). Resolves doc drift tracked in #628.

**Production screen:** `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx`

**Requirements:** `REQ-GRP-01` (list groups), `REQ-NAV-01` (Groups tab root).

---

## Screen anatomy (top → bottom)

```
┌────────────────────────────────────────┐
│ ProTrialLifecycleBanner (when shown)   │
├────────────────────────────────────────┤
│ Header — “My groups” + actions         │
│  (search · filter · create)            │
├────────────────────────────────────────┤
│ Scroll list (FlashList)                │
│  ┌──────────────────────────────────┐  │
│  │ GroupsListSummaryCard (optional)  │  │
│  │  single net balance in user base  │  │
│  │  currency + FX hint when needed   │  │
│  └──────────────────────────────────┘  │
│  GroupCard × N (active groups)          │
│  Archived section toggle + rows         │
└────────────────────────────────────────┘
  FiltersSheet (modal bottom sheet, overlay)
```

There is **no** list-footer “Create a group” button and **no** floating create CTA on this screen. Create is only via the header create control (and the empty-state primary action when the user has zero groups).

---

## Header (`GroupsListHeader`)

- **Title:** `groups.listTitle` → **“My groups”** (bold `text-2xl`), always shown when search is collapsed.
- **Actions (round icon buttons):** search, filter (`options-outline`), then create.
  - Search and filter use `RoundIconButton` (40×40, circular).
  - Filter shows a badge when any non-default sort/filter is active (`isAnyGroupListFilterActive`).
  - **Create:** primary-filled circle with `add` icon; on wider layouts may show a labelled pill (`groups.createGroup`) when horizontal space allows (`groupsListLayout.ts`).
- **Responsive layout:** viewports ≤392px stack title above a trailing action row; wider screens inline title + actions on one row.
- **Search expanded:** header row is replaced by full-width `SearchExpandable` (member + group name search, cancel collapses and clears).

Dev preview (web only): `GroupsListB2PreviewScreen` + `?devGroupsListB2Preview=1`.

---

## Summary card (`GroupsListSummaryCard`)

- One **aggregated net** balance in the user’s `defaultCurrency` (not per-currency rows).
- Label tone follows net sign: owed / owe / settled (`dashboard.netOwedToYou`, `dashboard.netYouOwe`, `dashboard.netBalance`).
- FX: uses the same profile balance conversion path as the profile hero (`useProfileBalanceSummary` + Frankfurter rates). Optional hint when foreign-currency groups exist but conversion failed (`groups.listSummary.otherCurrenciesHint`).
- Hidden when the user has **no groups**, while balances are still loading (`balanceUnknown`), or when summary parts are empty.
- Rendered as `ListHeaderComponent` inside the list (scrolls with groups).

`BalanceSummaryHeader` (per-currency owed/owe rows) exists in the codebase but is **not** used on this screen.

---

## Group rows (`GroupCard`)

- Avatar, highlighted group name (and matched member names in subtitle when search hits members).
- **Balance pill** (`BalanceChip`) on the trailing edge — uses simplified-debt rollups, user display currency, and optional FX from list rates.
- Unread activity badge when count > 0.
- Long-press / overflow menu (archive, share, etc.) — same card component as elsewhere.

---

## Filters & sort (`FiltersSheet`)

Bottom sheet (`FilterBottomSheet`) with live apply-on-change (clear resets to defaults):

| Dimension | Options |
|-----------|---------|
| Sort | recent (asc/desc), name (asc/desc), balance (asc/desc) |
| Balance | all, I owe, I’m owed, unsettled, settled |
| Group type | multi-select chips (empty = all) |
| Currency | multi-select from currencies present in the user’s groups |

**Archived groups:** not a filter-sheet toggle. Archived/auto-archived groups are listed under a **footer** control (`groups.archive.sectionLabel`) that expands/collapses archived rows below active groups.

Deep links / profile stats can pass `balanceState` and `showArchived` route params to pre-set filters and expand archived.

---

## Data & refresh

| Concern | Source |
|---------|--------|
| Groups + members | `useGroupsQuery()` → groups service / Supabase |
| Per-group balances & list summary | `useSimplifiedDebts()` → `deriveBalanceSummary` + `useProfileBalanceSummary` |
| Exchange rates | `useExchangeRatesQuery` for display currency / rollups |
| Client filter/sort | `lib/groupListQuery.ts` |

Pull-to-refresh invalidates groups + simplified debts and prefetches activity feed.

Initial load: auth gate seeds the groups cache before tabs mount; this screen renders **nothing** (not the full-screen boot splash) until cached groups exist — avoids tab-bar overlap.

---

## Empty & error states

- **No groups:** `EmptyState` with create + try demo actions.
- **Offline / load error:** dedicated empty variants with retry.
- **Only archived groups (no active):** no empty state; archived footer shows archived rows.

---

## Source-code map

| Piece | Path |
|-------|------|
| Screen | `apps/mobile/screens/groups/GroupsListScreen.tsx` |
| Header | `apps/mobile/components/groups/GroupsListHeader.tsx` |
| Summary card | `apps/mobile/components/groups/GroupsListSummaryCard.tsx` |
| Search | `apps/mobile/components/SearchExpandable.tsx` |
| Filters | `apps/mobile/components/FiltersSheet.tsx` |
| Filter/sort logic | `apps/mobile/lib/groupListQuery.ts` |
| Responsive header metrics | `apps/mobile/components/groupsListLayout.ts` |
| Row | `apps/mobile/components/GroupCard.tsx`, `BalanceChip.tsx` |
| Shared summary math | `packages/shared/src/calculations/groupsListSummary.ts` |
| Tests | `apps/mobile/__tests__/screens/groups/GroupsListScreen.test.tsx` |

---

## Superseded references (do not implement)

The sections below were an **earlier locked plan** (pre-B2). They are kept for history only.

| Superseded idea | Canonical B2 behavior |
|-----------------|----------------------|
| Per-currency `BalanceSummaryHeader` above the list | Single `GroupsListSummaryCard` (net in default currency) |
| Subtle header `+` **and** large list-footer “Create a group” | Header create only (+ empty-state CTA when no groups) |
| Header with expandable search **only** (no screen title) | **“My groups”** title + round search that expands to full-width input |
| NestJS `GET /users/me/balance-summary` as list data source | Simplified-debts RPC + client-side `deriveBalanceSummary` (Supabase-only stack) |
| Filter sheet “Show archived” switch | Archived groups in collapsible list footer |
| `docs/design_handoff_group_detail/prototype/screens/GroupsListScreen.jsx` | Old handoff prototype (wordmark header, persistent search row, FAB) — see note in that file |

For group **detail** layout, use `docs/design_handoff_group_detail/README.md` (not the list prototype).
