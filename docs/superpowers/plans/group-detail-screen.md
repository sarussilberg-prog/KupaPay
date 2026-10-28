# Group Detail Screen Redesign Implementation Plan

**Branch:** `fix-groups` (current)
**Target screen:** `apps/mobile/screens/groups/GroupDetailScreen.tsx`

**Goal:** Rebuild the "single group" screen as a single-scroll feed: a hero header (group image as background, name centered, back top-left, settings top-right), a row of quick actions, a searchable/filterable **mixed feed of expenses and group messages**, and a sticky bottom "Add expense" CTA. A small composer popup lets users send/edit/delete messages that appear in the same feed as expenses.

**Tech Stack:** Expo SDK 55 / React Native (NativeWind), Zustand store, NestJS server, Supabase Postgres (+ Realtime), i18next (en + he, RTL aware).

**Note for implementer:** Before writing any Expo-touching code (animations, sheets, keyboard avoiding, image background, sticky footer, safe-area) read the versioned docs at https://docs.expo.dev/versions/v55.0.0/ — see `apps/mobile/AGENTS.md`.

---

## Design decisions (locked in)

| Decision | Choice |
|---|---|
| Layout pattern | Single scroll feed. No tabs. |
| Hero header | Top ~1/3 of the screen. Group image fills it as a background with a dark scrim for legibility; group name centered in large type. Back chevron top-left, settings gear top-right. |
| No-image fallback | `groupType`-based gradient + the same icon `GroupAvatar` uses today. |
| Stat cards (members/expenses/total) | **Removed.** The hero replaces them visually. Deeper numbers stay in `BalancesScreen`. |
| Quick actions row | Four equal chips under the hero: **Settle up · Balances · Message · Export**. (Add expense lives in the sticky footer.) |
| "Message" action | Opens `MessageComposerSheet` — a small modal with a text input + send icon button. On send, message is persisted via `POST /groups/:id/messages` and appears in the feed. Same sheet (prefilled) handles edit. |
| "Export" action | CSV of this group's expenses, shared via `expo-sharing` (no new dep — verify). |
| Feed content | **Mixed.** Expenses and messages share one list. Each item is rendered by a row component selected by `item.kind`. |
| Feed sort order | **Unified `createdAt DESC`** for both expense and message items. Note: expense rows still display `expenseDate` in the date stack on the left — only the ordering uses `createdAt`. |
| Messages: scope | **Standalone only.** No replies / threading in v1. |
| Messages: realtime | **Supabase Realtime** — subscribe to `group_messages` for the current `groupId` while the screen is mounted; handle INSERT / UPDATE / DELETE. |
| Messages: edit + delete | Long-press your own message → action sheet → Edit (re-opens composer prefilled) or Delete (confirm dialog, soft-delete). Edited messages show an `(edited)` tag. |
| Per-expense delta source | Extend the expense list response to include `splits[]` inline so the client computes "you lent / you borrowed" in one round-trip. |
| Receipt thumbnail | `Expense.receiptUrl` if present; else category icon fallback. |
| Search + filter | Search bar above the feed. Search matches expense description, payer's `displayName`, **and message body**. Filters (category / member / date range) apply to expenses; messages always pass the filters (we don't filter messages by category/member/date in v1). |
| Sticky footer | "Add expense" pinned above the home-indicator inset. Composer popup floats above it when open. |
| Admin actions | Only entry point is the gear icon → existing `EditGroupScreen`. Delete + Leave + (future) Archive live in that screen's "Danger zone" section. |
| Pull-to-refresh | Re-fetches group, members, summary, balances, expenses, **and messages**. |
| Empty state (no expenses AND no messages) | A friendly card inside the scroll telling the user to add the first expense. Sticky footer still visible. |

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/types/index.ts` | Add `GroupMessage`, `ExpenseWithSplits`, `ExpenseWithDelta`, `FeedItem` types |
| `apps/server/src/services/expenses.service.ts` | `findAllForGroup` returns `ExpenseWithSplits[]` (JOIN splits) |
| `apps/server/src/controllers/expenses.controller.ts` | Type swap on list response |
| `apps/server/src/messages/messages.service.ts` | **New.** CRUD for `group_messages` |
| `apps/server/src/messages/messages.controller.ts` | **New.** List + create + update + soft-delete endpoints |
| `apps/server/src/messages/messages.module.ts` | **New.** Wire into the app module |
| `supabase/migrations/<ts>_group_messages.sql` | **New.** Table + RLS + realtime publication |
| `apps/server/src/services/__tests__/messages.service.spec.ts` | **New.** Coverage |
| `apps/mobile/services/expenses.service.ts` | `fetchExpenses` return type → `ExpenseWithSplits[]` |
| `apps/mobile/services/messages.service.ts` | **New.** `fetchMessages` / `createMessage` / `updateMessage` / `deleteMessage` |
| `apps/mobile/services/group-share.service.ts` | **New.** CSV export helper |
| `apps/mobile/hooks/useGroupMessagesRealtime.ts` | **New.** Subscribes to Supabase Realtime channel for this group |
| `apps/mobile/store/index.ts` | Expenses slice typed; add `messages` slice (`Record<groupId, GroupMessage[]>`) + setters/upsert/remove |
| `apps/mobile/components/GroupHero.tsx` | **New.** Image-background hero with title, back, gear |
| `apps/mobile/components/QuickActionsRow.tsx` | **New.** 4 icon+label chips |
| `apps/mobile/components/ExpenseRow.tsx` | **New.** New row layout (date stack · thumb · description · delta) |
| `apps/mobile/components/MessageRow.tsx` | **New.** Message row (avatar · name · body · time · `(edited)`); long-press → action sheet |
| `apps/mobile/components/FeedItemRow.tsx` | **New.** Picks `ExpenseRow` vs `MessageRow` from `item.kind` |
| `apps/mobile/components/MessageComposerSheet.tsx` | **New.** Modal with text input + send icon; used for create and edit |
| `apps/mobile/components/ExpenseFiltersSheet.tsx` | **New.** Bottom sheet (category / date range / member) |
| `apps/mobile/components/StickyFooterButton.tsx` | **New.** Safe-area-aware sticky CTA wrapper |
| `apps/mobile/screens/groups/GroupDetailScreen.tsx` | Rewrite |
| `apps/mobile/screens/groups/EditGroupScreen.tsx` | House Delete + Leave admin actions |
| `apps/mobile/i18n/locales/en.json` + `he.json` | New keys (Task 10) |
| `apps/mobile/__tests__/components/*` | Tests for new components |
| `apps/mobile/__tests__/screens/groups/GroupDetailScreen.test.tsx` | Rewrite |

---

## Task 1: Shared types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Steps:**
- [ ] Add:
  ```ts
  interface GroupMessage {
    id: string;
    groupId: string;
    userId: string;
    body: string;
    editedAt: string | null;     // ISO; null when never edited
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
  }

  interface ExpenseWithSplits extends Expense {
    splits: ExpenseSplit[];
  }

  // Client-derived only — not on the wire
  interface ExpenseWithDelta extends ExpenseWithSplits {
    myDelta: number;
    myDeltaState: 'lent' | 'borrowed' | 'settled';
  }

  type FeedItem =
    | { kind: 'expense'; sortAt: string; expense: ExpenseWithDelta }
    | { kind: 'message'; sortAt: string; message: GroupMessage };
  ```
- [ ] Re-export from `packages/shared/src/index.ts` if needed.
- [ ] Rebuild shared package (`npm run build` in `packages/shared`).

---

## Task 2: Server — embed splits in expense list

**Files:**
- Modify: `apps/server/src/services/expenses.service.ts`
- Modify: `apps/server/src/controllers/expenses.controller.ts`
- Modify: `apps/server/src/services/__tests__/expenses.service.spec.ts`

**Steps:**
- [ ] `findAllForGroup(groupId)`: single query JOINing `expense_splits`; group splits per expense; return `ExpenseWithSplits[]`. Filter `is_deleted = false`.
- [ ] Order by `created_at DESC` (matches the new feed sort). Keep `expense_date` for display.
- [ ] Controller return type → `ApiResponse<ExpenseWithSplits[]>`.
- [ ] Test: an expense with 3 splits comes back with `expense.splits.length === 3` and matching amounts.
- [ ] Verify no other callers rely on the previous shape (project-wide grep on `findAllForGroup`).

---

## Task 3: Server — group messages

**Files:**
- Create: `supabase/migrations/<timestamp>_group_messages.sql`
- Create: `apps/server/src/messages/messages.service.ts`
- Create: `apps/server/src/messages/messages.controller.ts`
- Create: `apps/server/src/messages/messages.module.ts`
- Modify: `apps/server/src/app.module.ts` (register `MessagesModule`)
- Create: `apps/server/src/services/__tests__/messages.service.spec.ts`

### 3.1 Database migration

- [ ] Create table `group_messages`:
  ```sql
  create table public.group_messages (
    id           uuid primary key default gen_random_uuid(),
    group_id     uuid not null references public.groups(id) on delete cascade,
    user_id      uuid not null references auth.users(id) on delete cascade,
    body         text not null check (length(body) between 1 and 2000),
    edited_at    timestamptz,
    is_deleted   boolean not null default false,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
  );

  create index group_messages_group_id_created_at_idx
    on public.group_messages (group_id, created_at desc);
  ```
- [ ] `updated_at` trigger: reuse the existing `set_updated_at()` function used elsewhere in the schema.
- [ ] **Enable RLS:** `alter table public.group_messages enable row level security;`
- [ ] Policies (mirror the pattern used by `expenses` / `group_members`):
  - `select`: user is an active member of `group_id` (subquery against `group_members`).
  - `insert`: user is an active member AND `user_id = auth.uid()`.
  - `update`: `user_id = auth.uid()` AND row is in a group the user is still an active member of.
  - No hard `delete` policy — deletion is a soft `update` setting `is_deleted = true`.
- [ ] **Realtime publication:** `alter publication supabase_realtime add table public.group_messages;`
- [ ] Run `mcp__supabase__apply_migration` once the SQL is finalized (do **not** apply blindly — review against staging first if possible).

### 3.2 NestJS endpoints

All routes require auth (same guard the other controllers use). Membership checks happen via RLS + an explicit service-layer check (belt + suspenders).

- [ ] `GET /groups/:groupId/messages?limit=100&before=<iso>` → `ApiResponse<GroupMessage[]>`
  - Returns rows where `is_deleted = false`, ordered by `created_at DESC`, limited (default 100, max 200).
  - `before` cursor for future pagination — implement the param but don't wire pagination UI in v1.
- [ ] `POST /groups/:groupId/messages` body `{ body: string }` → `ApiResponse<GroupMessage>`
  - Trim and reject empty / >2000 chars at the service layer too.
- [ ] `PATCH /messages/:id` body `{ body: string }` → `ApiResponse<GroupMessage>`
  - Service checks `user_id = currentUserId` AND `is_deleted = false` before update.
  - Set `edited_at = now()`.
- [ ] `DELETE /messages/:id` → `ApiResponse<{ id: string }>`
  - Soft-delete: `update group_messages set is_deleted = true, updated_at = now() where id = ? and user_id = ?`.
- [ ] Tests: create + read + edit + soft-delete happy paths; edit/delete of someone else's message rejected; insert with empty body rejected; over-long body rejected.

---

## Task 4: Mobile — data layer

**Files:**
- Modify: `apps/mobile/services/expenses.service.ts`
- Create: `apps/mobile/services/messages.service.ts`
- Create: `apps/mobile/hooks/useGroupMessagesRealtime.ts`
- Modify: `apps/mobile/store/index.ts`

**Steps:**

### 4.1 Expenses

- [ ] `fetchExpenses(groupId)`: return type → `Promise<ExpenseWithSplits[]>`. Update store setter accordingly.
- [ ] Selector `selectExpensesForGroup(groupId)`.
- [ ] Pure helper `computeMyDelta(expense, currentUserId)`:
  - `paidByMe = expense.paidBy === currentUserId ? expense.amount : 0`
  - `mySplit = splits.find(s => s.userId === currentUserId)?.amount ?? 0`
  - `delta = paidByMe - mySplit`; round to 2 dp; `'lent'` when positive, `'borrowed'` when negative, `'settled'` when ~0.
- [ ] Unit-test the helper (paid-by-me, paid-by-other, not-in-splits, settled).

### 4.2 Messages

- [ ] `messages.service.ts`:
  - `fetchMessages(groupId): Promise<GroupMessage[]>`
  - `createMessage(groupId, body: string): Promise<GroupMessage | null>`
  - `updateMessage(messageId, body: string): Promise<GroupMessage | null>`
  - `deleteMessage(messageId): Promise<boolean>` (soft)
  - Trim `body` before sending; refuse empty.
- [ ] Store slice: `messages: Record<string, GroupMessage[]>` keyed by `groupId`. Setters: `setMessages(groupId, list)`, `upsertMessage(msg)`, `removeMessage(groupId, messageId)`.
- [ ] Selectors: `selectMessagesForGroup(groupId)`; **`selectFeedForGroup(groupId, currentUserId)`** that returns `FeedItem[]` sorted by `sortAt DESC`. For each:
  - Expense → `{ kind: 'expense', sortAt: expense.createdAt, expense: { ...e, ...computeMyDelta(e, currentUserId) } }`
  - Message (only if `!isDeleted`) → `{ kind: 'message', sortAt: message.createdAt, message }`

### 4.3 Realtime hook

- [ ] `useGroupMessagesRealtime(groupId)`:
  - On mount: `supabase.channel(`group_messages:${groupId}`)` and subscribe to `postgres_changes` with `{ event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }`.
  - On `INSERT` / `UPDATE`: `upsertMessage(payload.new)`.
  - On `DELETE` (won't actually fire because deletes are soft; UPDATE-with-`isDeleted=true` is what we see) → `removeMessage`.
  - In the UPDATE handler: if `payload.new.isDeleted` is true, call `removeMessage`; else `upsertMessage`.
  - On unmount: `channel.unsubscribe()` and `supabase.removeChannel(channel)`.
  - Be defensive: if `groupId` changes between renders, unsubscribe + re-subscribe.
  - Confirm Realtime is enabled on the project (`mcp__supabase__list_extensions` / check the Realtime publication after Task 3.1).

---

## Task 5: Mobile — CSV export helper

**Files:**
- Create: `apps/mobile/services/group-share.service.ts`

**Steps:**
- [ ] `exportGroupCsv(group, expenses: ExpenseWithSplits[], members)`:
  - Columns: `Date, Description, Amount, Currency, Paid By, Splits (semicolon-separated "Name=Amount")`.
  - RFC 4180 escaping for commas + quotes.
  - Write under `FileSystem.cacheDirectory` as `${group.name}-${YYYY-MM-DD}.csv`.
  - Share via `Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: t('groups.share.exportTitle') })`.
  - Verify `expo-file-system` + `expo-sharing` are already in `package.json`; add if missing.
- [ ] Surface failures via the same toast/snackbar mechanism `SettingsScreen` uses.

---

## Task 6: New visual components

### 6a. `GroupHero`

- Props: `{ group: Group; onBack: () => void; onSettings: () => void }`.
- Outer: `height: Math.round(SCREEN_HEIGHT / 3)`. Portrait-first; don't react to orientation changes.
- Background: `<ImageBackground source={{ uri: group.imageUrl }} resizeMode="cover">` when present; else `<LinearGradient>` (verify `expo-linear-gradient` is installed) using two tones derived from `groupType`. Inside, absolute `View` with `bg-black/30` for legibility.
- Top safe area: `useSafeAreaInsets()`.
- Group name centered (`text-3xl font-bold text-white`, `numberOfLines={2}`, centered).
- Top-left: `<` chevron in `bg-black/40` circle; top-right: gear same style. RTL mirrors.
- A11y: `accessibilityLabel` on both (`t('common.back')`, `t('groups.settings')`).

### 6b. `QuickActionsRow`

- Props: `{ onSettleUp: () => void; onBalances: () => void; onMessage: () => void; onExport: () => void; settleUpDisabled?: boolean }`.
- Layout: `flex-row gap-2 px-4 -mt-6` so the row floats over the bottom of the hero (`zIndex: 10`).
- Each chip: rounded white card, subtle shadow, icon on top, label underneath (`text-xs`). Tap target ≥44pt.
- `Settle up` disabled state when group balance nets to 0: lower opacity, `pointerEvents="none"`.

### 6c. `ExpenseRow`

- Props: `{ expense: ExpenseWithDelta; payerName: string; onPress: (id: string) => void; searchQuery?: string }`.
- Layout (LTR; mirrors in RTL):
  - **Left (date stack, ~44px):** `MMM` uppercase small on top, `DD` large bold below. Source: `expense.expenseDate`.
  - **Thumb (40×40):** `receiptUrl` if present; else category icon fallback (generic receipt icon if no category icon).
  - **Center (`flex-1`):**
    - Description `text-base font-semibold text-gray-900 numberOfLines={1}`. If `searchQuery` matches, highlight via `HighlightedText` if available; else plain text.
    - Sub-line `text-xs text-gray-500`: `"{currency} {amount} · paid by {payerName}"` — use `t('expenses.paidBySub', { amount, name })`.
  - **Right:**
    - Top: `expense.currency {abs(myDelta).toFixed(2)}` — `text-emerald-600` lent / `text-rose-600` borrowed / `text-gray-400` settled. `numberOfLines={1}`.
    - Bottom: small label `t('groups.expense.youLent' | 'youBorrowed' | 'settled', { amount })`, `text-[10px]` muted.
- `React.memo`.

### 6d. `MessageRow`

- Props: `{ message: GroupMessage; senderName: string; senderAvatarUrl?: string; isMine: boolean; onEdit: (m: GroupMessage) => void; onDelete: (m: GroupMessage) => void; searchQuery?: string }`.
- Layout:
  - Visual is a chat-style row (no left date stack, no right amount), to distinguish it from expense rows.
  - **LTR:** small `MemberAvatar` left, then a bubble (`flex-1`) containing: sender name (`text-xs font-medium text-gray-600`) + body (`text-sm text-gray-900`, multiline) + footer line with relative time (`5m`, `2h`, etc. — use the project's existing time-ago util; match `ActivityItem`) and `(edited)` tag if `editedAt` is not null.
  - Bubble background: `bg-white` (matches expense card surface); padding `p-3`, `rounded-2xl`, subtle shadow.
  - When `isMine`, allow `onLongPress` → action sheet (`Edit`, `Delete`, `Cancel`). Use `ActionSheetIOS` on iOS and the existing modal-based equivalent on Android (match what other long-press actions in the app do — grep first).
  - If `searchQuery` matches, highlight via `HighlightedText`.
- `React.memo`.

### 6e. `FeedItemRow`

- Props: `{ item: FeedItem; ...everything ExpenseRow + MessageRow need }`.
- Switch on `item.kind` → render the right row. Keep this thin; it exists so the screen's `FlatList`/`ScrollView` map is clean.

### 6f. `MessageComposerSheet`

- Props: `{ visible: boolean; initialBody?: string; mode: 'create' | 'edit'; onSubmit: (body: string) => Promise<void>; onClose: () => void }`.
- Layout: `Modal` (`transparent`, `animationType="slide"`) with a small panel at the bottom:
  - Backdrop: `bg-black/40`, tap to dismiss.
  - Panel: `bg-white rounded-t-2xl p-3`, keyboard-avoiding (`KeyboardAvoidingView` with `behavior="padding"` on iOS / `"height"` on Android).
  - Row: `<TextInput multiline maxLength={2000}>` `flex-1` + circular send icon button on the right (`bg-primary`).
  - Send disabled until trimmed body is non-empty.
  - On submit: call `onSubmit`, clear and close on success; keep open + show error toast on failure.
- For `mode === 'edit'`, header line shows `t('groups.message.editTitle')`; send icon button label becomes "Save".
- Autofocus the input when `visible` becomes true.
- A11y labels on the send button and close affordance.

### 6g. `StickyFooterButton`

- Props: `{ title: string; onPress: () => void; icon?: IconName }`.
- `position: 'absolute'`, `bottom: 0`, full-width `bg-white`, top border, `pb: insets.bottom + 12`, primary `Button` inside.

### 6h. `ExpenseFiltersSheet`

- Same bottom-sheet pattern as the groups list filters (`FiltersSheet` / `FilterBottomSheet`). List layout spec: [groups-screeen.md](./groups-screeen.md) (canonical B2). Check whether `@gorhom/bottom-sheet` is installed; if not, use `Modal`. No new deps just for this.
- ```ts
  type ExpenseFilters = {
    categories: string[];
    memberIds: string[];          // payer or split participant
    dateFrom?: string;            // ISO
    dateTo?: string;              // ISO
  };
  ```
- Sections: chip multi-select for categories and members; two date inputs (reuse the date picker `AddExpenseScreen` uses).
- Footer: "Clear all" + "Apply" (no live-apply).

---

## Task 7: Rewrite `GroupDetailScreen`

**Files:**
- Modify: `apps/mobile/screens/groups/GroupDetailScreen.tsx`
- Modify: `apps/mobile/__tests__/screens/groups/GroupDetailScreen.test.tsx`

**Steps:**

- [ ] Set `headerShown: false` for the `GroupDetail` route in `AppNavigator.tsx`. The hero replaces the header.
- [ ] Local state: `searchQuery`, `filters`, `filtersOpen`, `composer: { open: boolean; mode: 'create'|'edit'; initialBody?: string; editingId?: string }`, `refreshing`.
- [ ] Load on mount: `Promise.all([getGroupById, getGroupMembers, getGroupSummary, getGroupBalances, fetchExpenses, fetchMessages])`. Refresh re-runs the same.
- [ ] **Wire `useGroupMessagesRealtime(groupId)`** at the top of the screen component.
- [ ] Build `memberMap` (id → `{ ...member, displayName, avatarUrl }`) once per render.
- [ ] Selector returns `feed: FeedItem[]` already sorted by `sortAt DESC` and delta-decorated.
- [ ] Compute `filteredFeed` (useMemo):
  1. For `kind === 'expense'`: apply category / member / date-range filters; apply search against description + payer's displayName.
  2. For `kind === 'message'`: skip expense filters; apply search against `body` + senderName.
- [ ] Derive `settleUpDisabled = balances.every(b => Math.round(b.netBalance * 100) === 0)`.
- [ ] Layout:
  ```
  <View flex-1 bg-slate-50>
    <ScrollView
      contentContainerStyle={{ paddingBottom: 96 }}
      refreshControl={…}>
      <GroupHero group={group} onBack={…} onSettings={…} />
      <QuickActionsRow ... />
      <View className="px-4 mt-4">
        <SearchBar value={searchQuery} onChangeText={…}
                   rightSlot={<FilterIconButton badged={isAnyFilterActive} onPress={…} />} />
      </View>
      {filteredFeed.length === 0
        ? <EmptyFeedCard onAdd={handleAddExpense} />
        : filteredFeed.map(item => <FeedItemRow … />)}
    </ScrollView>

    <StickyFooterButton title={t('expenses.addExpense')} icon="add" onPress={handleAddExpense} />

    <ExpenseFiltersSheet visible={filtersOpen} … />
    <MessageComposerSheet
      visible={composer.open}
      mode={composer.mode}
      initialBody={composer.initialBody}
      onSubmit={handleComposerSubmit}
      onClose={() => setComposer({ open: false, mode: 'create' })}
    />
  </View>
  ```
- [ ] Handlers:
  - `onBack` → `navigation.goBack()`
  - `onSettings` → `navigation.navigate('EditGroup', { groupId })`
  - `onSettleUp` → `navigation.navigate('Balances', { groupId })`
  - `onBalances` → `navigation.navigate('Balances', { groupId })`
  - `onMessage` → `setComposer({ open: true, mode: 'create' })`
  - `onExport` → `exportGroupCsv(group, filteredExpenses, members)` (export the *expenses* part of the filtered feed)
  - `onAddExpense` → `navigation.navigate('AddExpense', { groupId })`
  - `onExpensePress(id)` → `navigation.navigate('ExpenseDetail', { expenseId, groupId })`
  - `onMessageEdit(m)` → `setComposer({ open: true, mode: 'edit', initialBody: m.body, editingId: m.id })`
  - `onMessageDelete(m)` → confirm dialog → `deleteMessage(m.id)` → store removes optimistically; Realtime will reconcile.
  - `handleComposerSubmit(body)`:
    - `create` → `createMessage(groupId, body)`; store upserts; Realtime will also fire (idempotent upsert).
    - `edit` → `updateMessage(editingId, body)`; store upserts.
- [ ] Remove the in-place Edit + Delete buttons from this screen (moved to `EditGroupScreen` in Task 8).

- [ ] Tests:
  - Hero renders group name + image; gradient fallback when no image.
  - Back chevron → `goBack`; gear → `EditGroup`.
  - QuickActions: `Settle up` disabled when balances all zero.
  - QuickActions: `Message` opens composer.
  - QuickActions: `Export` calls `exportGroupCsv` (mock).
  - Expense row colors: lent green, borrowed red.
  - Mixed feed: expenses and messages interleave by createdAt; ordering correct.
  - Search matches expense description, payer name, and message body.
  - Filter sheet: applying a category hides non-matching expenses; messages stay visible.
  - Empty feed: `EmptyFeedCard` shown; sticky footer still visible.
  - Composer: submits via `createMessage` (mock); on success, sheet closes.
  - Long-press on own message → action sheet (mock platform sheet); Edit prefills composer; Delete confirms then calls `deleteMessage`.
  - Long-press on someone else's message: no action sheet appears.
  - Edited message displays `(edited)`.
  - Realtime hook: subscribe on mount, unsubscribe on unmount (assert via mock).

---

## Task 8: `EditGroupScreen` — admin actions

**Files:**
- Modify: `apps/mobile/screens/groups/EditGroupScreen.tsx`

**Steps:**
- [ ] If not already there, add a "Danger zone" section using `SettingsSection` + `SettingsRow` with destructive variant: `Delete group` (existing logic), `Leave group` (new — calls `removeGroupMember(groupId, currentUserId)` then `navigation.popToTop()`).
- [ ] Move the `ConfirmDialog` for delete out of `GroupDetailScreen`.
- [ ] Header title: `t('groups.settings')`.
- [ ] Do **not** add an archive flag in this branch — flagged in Out of scope.

---

## Task 9: Permissions & Realtime smoke test

- [ ] After applying the migration, verify the publication:
  - `select * from pg_publication_tables where pubname = 'supabase_realtime';` includes `group_messages`.
- [ ] Run `mcp__supabase__get_advisors` for both `security` and `performance` types after the migration; address any new warnings on `group_messages` (RLS missing, no index, etc.).
- [ ] Manually verify: insert a row as user A; confirm user B (in the same group) gets the Realtime event in the mobile app.

---

## Task 10: i18n keys

**Files:**
- Modify: `apps/mobile/i18n/locales/en.json`
- Modify: `apps/mobile/i18n/locales/he.json`

**New keys (group under `groups.*`, `expenses.*`):**

```
"groups.settings"                     // "Group settings"

"groups.actions.settleUp"             // "Settle up"
"groups.actions.balances"             // "Balances"
"groups.actions.message"              // "Message"
"groups.actions.export"               // "Export"

"groups.share.exportTitle"            // "Export expenses"
"groups.share.exportFilename"         // "{{name}}-{{date}}.csv"
"groups.share.exportError"            // "Couldn't generate the file"

"groups.expense.youLent"              // "You lent {{amount}}"
"groups.expense.youBorrowed"          // "You borrowed {{amount}}"
"groups.expense.settled"              // "Settled"

"groups.message.composerPlaceholder"  // "Write a message…"
"groups.message.send"                 // "Send"
"groups.message.edit"                 // "Edit"
"groups.message.delete"               // "Delete"
"groups.message.editTitle"            // "Edit message"
"groups.message.edited"               // "(edited)"
"groups.message.deleteConfirm"        // "Delete this message?"
"groups.message.sendError"            // "Couldn't send the message"
"groups.message.tooLong"              // "Message is too long"

"groups.search.placeholder"           // "Search expenses or messages"

"groups.filters.title"                // (reuse from list-screen plan)
"groups.filters.category.label"       // "Category"
"groups.filters.member.label"         // "Member"
"groups.filters.dateRange.label"      // "Date range"
"groups.filters.dateRange.from"       // "From"
"groups.filters.dateRange.to"         // "To"

"expenses.paidBySub"                  // "{{amount}} · paid by {{name}}"

"groups.emptyFeed.title"              // "Nothing here yet"
"groups.emptyFeed.message"            // "Add the first expense or send the first message."
"groups.emptyFeed.action"             // "Add the first expense"
```

- [ ] Add English values.
- [ ] Add Hebrew translations; verify RTL ordering visually.

---

## Task 11: Manual QA pass

- [ ] Group with image: hero shows photo with readable name overlay; group without image: gradient + groupType icon.
- [ ] Long group name: wraps to 2 lines, ellipsizes.
- [ ] iPhone notch + home-indicator: chevron/gear in top safe area; sticky footer above bottom inset.
- [ ] Hero scrolls with content.
- [ ] Quick actions float over the bottom edge of the hero; tap targets ≥44pt.
- [ ] Expense row: lent green, borrowed red, settled gray. Thumbnail falls back when no receipt.
- [ ] Search hits expense description, payer name, **and message body**.
- [ ] Filter sheet: category, member, date-range each work; badge appears when filters active. Messages stay visible regardless of filters.
- [ ] Pull-to-refresh re-fetches expenses + messages; deltas recompute.
- [ ] Sticky "Add expense" stays pinned during scroll.
- [ ] Settings gear → `EditGroupScreen`; Delete + Leave live there.
- [ ] Message chip → composer opens, keyboard pushes panel up; sending clears + closes; new message appears at the top of the feed.
- [ ] Two-device test: device A sends a message; device B (same group, screen open) sees it within ~1s via Realtime — no refresh needed.
- [ ] Long-press own message → action sheet; Edit prefills composer; sending updates the row with `(edited)` tag.
- [ ] Long-press own message → Delete → confirm → row disappears for sender and (via Realtime) for other members.
- [ ] Long-press someone else's message → no action sheet appears.
- [ ] Mixed feed: ordering by `createdAt` is consistent across devices.
- [ ] Export action produces a CSV via native share sheet with the right columns.
- [ ] RTL (he): hero text centered, chevron + gear mirror, expense row + message row mirror correctly.

---

## Suggested build order

1. Task 1 (shared types) — unblocks server + mobile.
2. Task 2 (server: splits inline).
3. Task 3 (server + DB: group_messages, Realtime, endpoints).
4. Task 4 (mobile data layer: expenses + messages + Realtime hook + `computeMyDelta`).
5. Task 6 (visual components — start with hero + quick actions + expense row; messages second).
6. Task 7 (screen rewrite).
7. Task 5 (CSV export — slot in any time after Task 7's handlers exist).
8. Task 8 (EditGroupScreen admin actions).
9. Task 9 (Realtime smoke + advisors).
10. Task 10 (i18n) — sweep throughout, final pass at the end.
11. Task 11 (manual QA).

---

## Out of scope (do NOT do in this branch)

- Threaded replies / comments under a specific expense. Messages are standalone in v1.
- Pagination UI for messages. Endpoint accepts a `before` cursor but the screen fetches the latest 100 only.
- Per-counterparty prefill on `Settle up` deep-link from the hero. Goes through `BalancesScreen`.
- PDF export. CSV only.
- Group archive feature / `isActive` toggle.
- Renaming the `EditGroup` route to `GroupSettings`. Header title only.
- Server-side expense or message search. Both stay client-side.
- Push notifications for new messages.
- Attachments (images, files) in messages. Body is plain text only.
- Changes to `BalancesScreen`, `SettleUpScreen`, `GroupMembersScreen`, `AddExpenseScreen` beyond required type updates.
