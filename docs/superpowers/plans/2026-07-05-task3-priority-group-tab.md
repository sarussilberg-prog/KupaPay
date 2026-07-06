# Priority Group Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th bottom tab "קבוצה בעדיפות" (Priority Group) that always opens on a user-chosen group (persisted `priorityGroupId`, falling back to the first group), reusing `GroupDetailScreen`, with an in-tab button to switch which group is the priority one.

**Architecture:** A new persisted `priorityGroupId: string | null` slice + setter is added to the existing Zustand store (persisted via AsyncStorage/SuperJSON). A pure resolver (`resolvePriorityGroupId`) and a hook (`useEffectivePriorityGroupId`) derive the effective group id from the store value + the `useGroupsQuery` list, falling back to the first group and handling invalid/deleted ids. A new `PriorityGroupStack` (mirroring `GroupsStack`) renders `GroupDetailScreen` as its root with `groupId` fed from the effective id, wrapped by a small header component (`PriorityGroupSwitcher`) that opens a `GroupPickerSheet` (a reusable Modal-based picker modelled on `FriendGroupBalancesSheet`). An empty-state screen covers the no-groups / all-invalid case. `MainTabs` grows from 3 to 4 tabs.

**Tech Stack:** Expo React Native, TypeScript, Zustand + `zustand/middleware` persist + SuperJSON, `@react-navigation/bottom-tabs` + `@react-navigation/native-stack`, `@tanstack/react-query`, react-i18next (RTL Hebrew), Ionicons via `AppIcon`, Jest + `jest-expo` + `@testing-library/react-native`.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `cost-share-app/apps/mobile/lib/priorityGroup.ts` | Pure resolver `resolvePriorityGroupId(storedId, groups)` → effective group id or `null`. Ordering = same as `GroupsListScreen` default (first row of the default sort). No React, easily unit-tested. |
| `cost-share-app/apps/mobile/__tests__/lib/priorityGroup.test.ts` | Unit tests for `resolvePriorityGroupId` (fallback, invalid id, deleted/left group, empty list). |
| `cost-share-app/apps/mobile/hooks/useEffectivePriorityGroupId.ts` | Hook wiring the store value + `useGroupsQuery` through `resolvePriorityGroupId`. |
| `cost-share-app/apps/mobile/__tests__/hooks/useEffectivePriorityGroupId.test.tsx` | Hook test (store id honored, fallback to first, invalid → first). |
| `cost-share-app/apps/mobile/components/priorityGroup/GroupPickerSheet.tsx` | Reusable Modal group-picker (`visible`, `groups`, `selectedGroupId`, `onSelectGroup`, `onClose`), modelled on `FriendGroupBalancesSheet`. |
| `cost-share-app/apps/mobile/__tests__/components/GroupPickerSheet.test.tsx` | Renders group rows, taps route to `onSelectGroup`. |
| `cost-share-app/apps/mobile/components/priorityGroup/PriorityGroupSwitcher.tsx` | Small header button showing the current group name; opens `GroupPickerSheet`; calls `setPriorityGroupId`. |
| `cost-share-app/apps/mobile/__tests__/components/PriorityGroupSwitcher.test.tsx` | Shows group name; tap opens sheet; selecting a group sets store + closes. |
| `cost-share-app/apps/mobile/screens/priorityGroup/PriorityGroupScreen.tsx` | Tab root: resolves effective id, renders empty-state when none, otherwise `PriorityGroupSwitcher` header + `GroupDetailScreen` fed the effective `groupId`. |
| `cost-share-app/apps/mobile/__tests__/screens/PriorityGroupScreen.test.tsx` | Empty-state when no groups; renders switcher + detail when a group exists. |

### Modified

| Path | Responsibility |
|---|---|
| `cost-share-app/apps/mobile/store/index.ts` | Add `priorityGroupId` + `setPriorityGroupId`; persist it in `partialize`. |
| `cost-share-app/apps/mobile/__tests__/store/index.test.ts` | Reset `priorityGroupId` in `beforeEach`; add `priorityGroupId` describe block. |
| `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` | Add `PriorityGroupStack` + wire a 4th `Tab.Screen` into `MainTabs` in RTL order Groups · Activity · Priority · Profile. |
| `cost-share-app/apps/mobile/i18n/locales/en.json` | Add `tabs.priorityGroup` + `priorityGroup.*` keys. |
| `cost-share-app/apps/mobile/i18n/locales/he.json` | Same keys, Hebrew. |

---

## Conventions locked for this plan (keep consistent across tasks)

- **Store field:** `priorityGroupId: string | null`; **setter:** `setPriorityGroupId(id: string | null)`.
- **Resolver:** `resolvePriorityGroupId(storedId: string | null, groups: GroupWithMembers[]): string | null` in `lib/priorityGroup.ts`.
- **Hook:** `useEffectivePriorityGroupId(): string | null` in `hooks/useEffectivePriorityGroupId.ts`.
- **Picker component:** `GroupPickerSheet` with props `{ visible, groups, selectedGroupId, onSelectGroup, onClose }`.
- **Switcher component:** `PriorityGroupSwitcher` with props `{ groupId, groupName, groups }` (reads `setPriorityGroupId` from the store itself).
- **Tab name:** `"PriorityGroup"`; **stack root screen name:** `"PriorityGroupHome"` (so `tabPopToTopOnPress('PriorityGroupHome')` works).
- **Icon:** `tabBarIcon('star', 'star-outline')` — `star` / `star-outline` are core Ionicons present in every `@expo/vector-icons` Ionicons build (same pattern as the existing `('people','people-outline')`).
- **i18n keys:** `tabs.priorityGroup`, `priorityGroup.switchLabel`, `priorityGroup.pickerTitle`, `priorityGroup.emptyTitle`, `priorityGroup.emptyMessage`, `priorityGroup.emptyCta`.

## "First group" ordering — verified

`fetchGroups()` (`services/groups.service.ts:222`, internal at `:201`) returns groups ordered by `created_at DESC`. `GroupsListScreen` (`screens/groups/GroupsListScreen.tsx:171-203`) re-sorts with `sortGroups(..., filters.sortBy='recentDesc', ...)` (`lib/groupListQuery.ts:71`), whose default case sorts by `updatedAt DESC` and pushes archived groups (`isGroupArchived`) to the end. For the "first group" fallback we mirror the **screen** behavior: exclude archived, then take the group with the newest `updatedAt`. This is deterministic and matches what the user sees at the top of the list. `resolvePriorityGroupId` reuses `sortGroups` + `isGroupArchived` from `lib/groupListQuery.ts` so there is one ordering source of truth (DRY).

## Dependency on Task 2 (mark-seen) — explicit

Task 2 (`docs/superpowers/specs/2026-07-05-home-experience-upgrades-design.md` §משימה 2) delivers the `mark_group_activity_seen(p_group_id)` RPC and a client hook. The spec asks the Priority Group tab to mark its shown group as seen on focus (§משימה 2, line 65). **This plan does NOT implement mark-seen** — that RPC/hook is owned by the Task 2 plan. `PriorityGroupScreen` is built so the mark-seen call is a one-line addition later:

```tsx
// TODO(task2): when useMarkGroupSeen from Task 2 is merged, call it here.
// useFocusEffect(useCallback(() => { markGroupSeen(effectiveGroupId); }, [effectiveGroupId]));
```

If Task 2 is already merged when you implement this, add that `useFocusEffect` in Task 3 (below) and a test; otherwise leave the TODO. Do not invent an RPC — it must be the exact hook Task 2 ships.

---

## Task 1 — Store: persisted `priorityGroupId` + setter

**Files:**
- Modify: `cost-share-app/apps/mobile/store/index.ts` (interface `AppState` ~lines 8-41; store body ~lines 45-77; `partialize` ~lines 96-99)
- Modify (test): `cost-share-app/apps/mobile/__tests__/store/index.test.ts` (`beforeEach` ~lines 3-9; add describe block)

Run all commands from `cost-share-app/apps/mobile`.

- [ ] **Write failing test.** In `__tests__/store/index.test.ts`, add `priorityGroupId: null` to the `beforeEach` reset object so it reads:

```ts
beforeEach(() => {
    useAppStore.setState({
        session: null,
        currentUser: null,
        language: 'en',
        priorityGroupId: null,
    });
});
```

Then append this describe block before the final closing `});` of `describe('useAppStore', ...)`:

```ts
    describe('priorityGroupId', () => {
        it('starts as null', () => {
            expect(useAppStore.getState().priorityGroupId).toBeNull();
        });

        it('setPriorityGroupId updates the value', () => {
            useAppStore.getState().setPriorityGroupId('group-42');
            expect(useAppStore.getState().priorityGroupId).toBe('group-42');
        });

        it('setPriorityGroupId(null) clears the value', () => {
            useAppStore.getState().setPriorityGroupId('group-42');
            useAppStore.getState().setPriorityGroupId(null);
            expect(useAppStore.getState().priorityGroupId).toBeNull();
        });
    });
```

- [ ] **Run and expect failure.** Run:

```bash
npx jest __tests__/store/index.test.ts --watchman=false
```

Expect a TypeScript/runtime failure because `setPriorityGroupId` does not exist yet, e.g.:

```
TypeError: useAppStore.getState().setPriorityGroupId is not a function
```

(and/or a `tsc`/type error that `priorityGroupId` is not a key of the state). Tests in the new `priorityGroupId` block fail.

- [ ] **Minimal implementation.** In `store/index.ts`, add to the `AppState` interface (after the `pendingDeactivationNotice` setter, before the closing `}` at line 41):

```ts
    // Priority group — the group the "Priority Group" tab opens on. Persisted.
    // Setter only stores the id; the effective/fallback resolution lives in
    // lib/priorityGroup.ts so it can be unit-tested without a store.
    priorityGroupId: string | null;
    setPriorityGroupId: (id: string | null) => void;
```

Add to the store body (after the `pendingDeactivationNotice` lines ~76, before the closing `}),` at line 77):

```ts
            // Priority group state
            priorityGroupId: null,
            setPriorityGroupId: (id) => set({ priorityGroupId: id }),
```

Add to `partialize` so it survives launches (line 96-99):

```ts
            partialize: (state) => ({
                currentUser: state.currentUser,
                language: state.language,
                priorityGroupId: state.priorityGroupId,
            }),
```

- [ ] **Run and expect pass.** Run:

```bash
npx jest __tests__/store/index.test.ts --watchman=false
```

Expect all `useAppStore` tests (session, language, and the new `priorityGroupId` block) to pass.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/store/index.ts \
        cost-share-app/apps/mobile/__tests__/store/index.test.ts
git commit -m "feat(store): add persisted priorityGroupId + setter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 — Resolver `resolvePriorityGroupId` (effective group + fallback)

**Files:**
- Create: `cost-share-app/apps/mobile/lib/priorityGroup.ts`
- Create (test): `cost-share-app/apps/mobile/__tests__/lib/priorityGroup.test.ts`

Reuses `sortGroups` + `isGroupArchived` from `lib/groupListQuery.ts` (verified at `lib/groupListQuery.ts:41,71`) so ordering matches `GroupsListScreen`.

- [ ] **Write failing test.** Create `__tests__/lib/priorityGroup.test.ts`:

```ts
import { resolvePriorityGroupId } from '../../lib/priorityGroup';
import { GroupWithMembers } from '@cost-share/shared';

function makeGroup(
    id: string,
    updatedAt: string,
    overrides: Partial<GroupWithMembers> = {},
): GroupWithMembers {
    return {
        id,
        name: `Group ${id}`,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date(updatedAt),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

describe('resolvePriorityGroupId', () => {
    const older = makeGroup('a', '2026-01-01T00:00:00Z');
    const newer = makeGroup('b', '2026-03-01T00:00:00Z');
    const groups = [older, newer];

    it('returns null when there are no groups', () => {
        expect(resolvePriorityGroupId('anything', [])).toBeNull();
        expect(resolvePriorityGroupId(null, [])).toBeNull();
    });

    it('falls back to the first group (newest updatedAt, same order as the list) when stored id is null', () => {
        expect(resolvePriorityGroupId(null, groups)).toBe('b');
    });

    it('falls back to the first group when stored id is not in the list (deleted / left)', () => {
        expect(resolvePriorityGroupId('gone', groups)).toBe('b');
    });

    it('honors a valid stored id even when it is not the first group', () => {
        expect(resolvePriorityGroupId('a', groups)).toBe('a');
    });

    it('never returns an archived group as the fallback; prefers an active one', () => {
        const archivedNewest = makeGroup('c', '2026-05-01T00:00:00Z', {
            isArchivedByMe: true,
        });
        // c is newest but archived → fallback should skip it and pick active b.
        expect(resolvePriorityGroupId(null, [older, newer, archivedNewest])).toBe('b');
    });

    it('honors a valid stored id even if that group is archived', () => {
        const archived = makeGroup('c', '2026-05-01T00:00:00Z', {
            isArchivedByMe: true,
        });
        expect(resolvePriorityGroupId('c', [older, newer, archived])).toBe('c');
    });

    it('falls back to an archived group only when it is the sole option', () => {
        const onlyArchived = makeGroup('c', '2026-05-01T00:00:00Z', {
            isArchivedByMe: true,
        });
        expect(resolvePriorityGroupId(null, [onlyArchived])).toBe('c');
    });
});
```

- [ ] **Run and expect failure.** Run:

```bash
npx jest __tests__/lib/priorityGroup.test.ts --watchman=false
```

Expect a module-resolution failure because the file does not exist yet:

```
Cannot find module '../../lib/priorityGroup' from '__tests__/lib/priorityGroup.test.ts'
```

- [ ] **Minimal implementation.** Create `lib/priorityGroup.ts`:

```ts
/**
 * Resolves the "effective" priority group id: the group the Priority Group tab
 * should open on. Kept pure (no React, no store) so it is trivially unit-tested.
 *
 * Rules:
 *  - No groups → null (caller shows the empty state).
 *  - Stored id present AND still in the list → use it (even if archived; the
 *    user explicitly pinned it).
 *  - Otherwise fall back to the FIRST group in the same order GroupsListScreen
 *    shows: default sort ('recentDesc' = newest updatedAt first) with archived
 *    groups pushed to the end. If every group is archived, the first archived
 *    one is used rather than returning null.
 */
import { GroupWithMembers } from '@cost-share/shared';
import { isGroupArchived, sortGroups } from './groupListQuery';

export function resolvePriorityGroupId(
    storedId: string | null,
    groups: GroupWithMembers[],
): string | null {
    if (groups.length === 0) return null;

    if (storedId && groups.some((g) => g.id === storedId)) {
        return storedId;
    }

    // Same ordering as the groups list: default sort, archived last.
    const ordered = sortGroups(groups, 'recentDesc', {});
    const firstActive = ordered.find((g) => !isGroupArchived(g));
    return (firstActive ?? ordered[0]).id;
}
```

- [ ] **Run and expect pass.** Run:

```bash
npx jest __tests__/lib/priorityGroup.test.ts --watchman=false
```

Expect all 7 `resolvePriorityGroupId` cases to pass.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/lib/priorityGroup.ts \
        cost-share-app/apps/mobile/__tests__/lib/priorityGroup.test.ts
git commit -m "feat(priority-group): add resolvePriorityGroupId with first-group fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 — Hook `useEffectivePriorityGroupId`

**Files:**
- Create: `cost-share-app/apps/mobile/hooks/useEffectivePriorityGroupId.ts`
- Create (test): `cost-share-app/apps/mobile/__tests__/hooks/useEffectivePriorityGroupId.test.tsx`

Wires `useAppStore(s => s.priorityGroupId)` + `useGroupsQuery()` through `resolvePriorityGroupId`. Test seeds the singleton `queryClient` (pattern from `renderWithQuery`) so `useGroupsQuery` reads cached data without hitting the network.

- [ ] **Write failing test.** Create `__tests__/hooks/useEffectivePriorityGroupId.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { useAppStore } from '../../store';
import { useEffectivePriorityGroupId } from '../../hooks/useEffectivePriorityGroupId';
import { GroupWithMembers } from '@cost-share/shared';

function makeGroup(id: string, updatedAt: string): GroupWithMembers {
    return {
        id,
        name: `Group ${id}`,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date(updatedAt),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

function Probe() {
    const id = useEffectivePriorityGroupId();
    return <Text testID="effective">{id ?? 'none'}</Text>;
}

function renderProbe() {
    return render(
        <QueryClientProvider client={queryClient}>
            <Probe />
        </QueryClientProvider>,
    );
}

const groups = [
    makeGroup('a', '2026-01-01T00:00:00Z'),
    makeGroup('b', '2026-03-01T00:00:00Z'),
];

beforeEach(() => {
    queryClient.clear();
    useAppStore.setState({ priorityGroupId: null });
});

describe('useEffectivePriorityGroupId', () => {
    it('returns null when there are no groups', () => {
        queryClient.setQueryData(queryKeys.groups, []);
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('none');
    });

    it('falls back to the first group when nothing is stored', () => {
        queryClient.setQueryData(queryKeys.groups, groups);
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('b');
    });

    it('honors a stored valid id', () => {
        queryClient.setQueryData(queryKeys.groups, groups);
        useAppStore.setState({ priorityGroupId: 'a' });
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('a');
    });

    it('falls back to the first group when the stored id is no longer a member group', () => {
        queryClient.setQueryData(queryKeys.groups, groups);
        useAppStore.setState({ priorityGroupId: 'deleted-group' });
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('b');
    });
});
```

- [ ] **Run and expect failure.** Run:

```bash
npx jest __tests__/hooks/useEffectivePriorityGroupId.test.tsx --watchman=false
```

Expect a module-resolution failure:

```
Cannot find module '../../hooks/useEffectivePriorityGroupId' from '__tests__/hooks/useEffectivePriorityGroupId.test.tsx'
```

- [ ] **Minimal implementation.** Create `hooks/useEffectivePriorityGroupId.ts`:

```ts
/**
 * The effective priority-group id for the Priority Group tab: the stored
 * priorityGroupId if still valid, else the first group in the list (see
 * resolvePriorityGroupId). Returns null only when the user has no groups.
 */
import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useGroupsQuery } from './queries/useGroupsQuery';
import { resolvePriorityGroupId } from '../lib/priorityGroup';

export function useEffectivePriorityGroupId(): string | null {
    const storedId = useAppStore((s) => s.priorityGroupId);
    const { data: groups } = useGroupsQuery();

    return useMemo(
        () => resolvePriorityGroupId(storedId, groups ?? []),
        [storedId, groups],
    );
}
```

- [ ] **Run and expect pass.** Run:

```bash
npx jest __tests__/hooks/useEffectivePriorityGroupId.test.tsx --watchman=false
```

Expect all 4 cases to pass.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/hooks/useEffectivePriorityGroupId.ts \
        cost-share-app/apps/mobile/__tests__/hooks/useEffectivePriorityGroupId.test.tsx
git commit -m "feat(priority-group): add useEffectivePriorityGroupId hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 — `GroupPickerSheet` (reusable group picker)

**Files:**
- Create: `cost-share-app/apps/mobile/components/priorityGroup/GroupPickerSheet.tsx`
- Create (test): `cost-share-app/apps/mobile/__tests__/components/GroupPickerSheet.test.tsx`

Modelled on `components/dashboard/FriendGroupBalancesSheet.tsx` (Modal + scrim + rows with `GroupAvatar` + `onSelectGroup`). Unlike that sheet it takes the group list as a prop (no query) so it is pure/presentational and easy to test.

- [ ] **Write failing test.** Create `__tests__/components/GroupPickerSheet.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupPickerSheet } from '../../components/priorityGroup/GroupPickerSheet';
import { GroupWithMembers } from '@cost-share/shared';

function makeGroup(id: string, name: string): GroupWithMembers {
    return {
        id,
        name,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

const groups = [makeGroup('g1', 'Trip'), makeGroup('g2', 'Roommates')];

describe('GroupPickerSheet', () => {
    it('renders a row per group when visible', () => {
        const { getByText } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={() => {}}
                onClose={() => {}}
            />,
        );
        expect(getByText('Trip')).toBeTruthy();
        expect(getByText('Roommates')).toBeTruthy();
    });

    it('calls onSelectGroup with the tapped group id', () => {
        const onSelectGroup = jest.fn();
        const { getByTestId } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={onSelectGroup}
                onClose={() => {}}
            />,
        );
        fireEvent.press(getByTestId('group-picker-row-g2'));
        expect(onSelectGroup).toHaveBeenCalledTimes(1);
        expect(onSelectGroup).toHaveBeenCalledWith('g2');
    });

    it('closes via the scrim', () => {
        const onClose = jest.fn();
        const { getByTestId } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={() => {}}
                onClose={onClose}
            />,
        );
        fireEvent.press(getByTestId('group-picker-scrim'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Run and expect failure.** Run:

```bash
npx jest __tests__/components/GroupPickerSheet.test.tsx --watchman=false
```

Expect:

```
Cannot find module '../../components/priorityGroup/GroupPickerSheet' from '__tests__/components/GroupPickerSheet.test.tsx'
```

- [ ] **Minimal implementation.** Create `components/priorityGroup/GroupPickerSheet.tsx`:

```tsx
/**
 * GroupPickerSheet — a Modal list picker for choosing the priority group.
 * Presentational: receives `groups` as a prop (no query), so it's reused by the
 * PriorityGroupSwitcher and is easy to unit-test. Modelled on
 * components/dashboard/FriendGroupBalancesSheet.tsx.
 */
import React from 'react';
import { Modal, Pressable, View, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupWithMembers } from '@cost-share/shared';
import { Text } from '../AppText';
import { GroupAvatar } from '../GroupAvatar';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

interface Props {
    visible: boolean;
    groups: GroupWithMembers[];
    selectedGroupId: string | null;
    onSelectGroup: (groupId: string) => void;
    onClose: () => void;
}

export function GroupPickerSheet({
    visible,
    groups,
    selectedGroupId,
    onSelectGroup,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                testID="group-picker-scrim"
                onPress={onClose}
                className="flex-1 bg-black/40 justify-center px-4"
            >
                <Pressable onPress={() => {}} className="bg-white rounded-2xl max-h-[60%]">
                    <View
                        style={rtlRowStyle(isRtl)}
                        className="px-4 pt-4 pb-3 items-center border-b border-slate-100"
                    >
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                                {t('priorityGroup.pickerTitle')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={t('common.cancel')}
                            testID="group-picker-close"
                        >
                            <AppIcon name="close" size={22} color={colors.gray500} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingVertical: 4 }}>
                        {groups.map((g, idx) => {
                            const isLast = idx === groups.length - 1;
                            const isSelected = g.id === selectedGroupId;
                            return (
                                <TouchableOpacity
                                    key={g.id}
                                    onPress={() => onSelectGroup(g.id)}
                                    style={rtlRowStyle(isRtl)}
                                    className={`items-center px-4 py-3 ${isLast ? '' : 'border-b border-slate-100'}`}
                                    accessibilityRole="button"
                                    testID={`group-picker-row-${g.id}`}
                                >
                                    <GroupAvatar
                                        imageUrl={g.imageUrl}
                                        groupType={g.groupType}
                                        size="sm"
                                    />
                                    <View style={{ flex: 1, marginHorizontal: 12, minWidth: 0 }}>
                                        <Text
                                            className="text-sm font-medium text-gray-900"
                                            numberOfLines={1}
                                        >
                                            {g.name}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <AppIcon name="checkmark" size={18} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
```

- [ ] **Run and expect pass.** Run:

```bash
npx jest __tests__/components/GroupPickerSheet.test.tsx --watchman=false
```

Expect all 3 cases to pass.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/components/priorityGroup/GroupPickerSheet.tsx \
        cost-share-app/apps/mobile/__tests__/components/GroupPickerSheet.test.tsx
git commit -m "feat(priority-group): add reusable GroupPickerSheet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 — `PriorityGroupSwitcher` (header button + picker wiring)

**Files:**
- Create: `cost-share-app/apps/mobile/components/priorityGroup/PriorityGroupSwitcher.tsx`
- Create (test): `cost-share-app/apps/mobile/__tests__/components/PriorityGroupSwitcher.test.tsx`

Renders a compact button showing the current group name + a swap icon; tapping opens `GroupPickerSheet`; selecting a group calls `setPriorityGroupId` (read from the store) and closes the sheet. The `beforeEach` resets `priorityGroupId` for isolation.

- [ ] **Write failing test.** Create `__tests__/components/PriorityGroupSwitcher.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PriorityGroupSwitcher } from '../../components/priorityGroup/PriorityGroupSwitcher';
import { useAppStore } from '../../store';
import { GroupWithMembers } from '@cost-share/shared';

function makeGroup(id: string, name: string): GroupWithMembers {
    return {
        id,
        name,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

const groups = [makeGroup('g1', 'Trip'), makeGroup('g2', 'Roommates')];

beforeEach(() => {
    useAppStore.setState({ priorityGroupId: null });
});

describe('PriorityGroupSwitcher', () => {
    it('shows the current group name on the switch button', () => {
        const { getByTestId } = render(
            <PriorityGroupSwitcher groupId="g1" groupName="Trip" groups={groups} />,
        );
        expect(getByTestId('priority-switch-btn')).toBeTruthy();
        expect(getByTestId('priority-switch-label').props.children).toBe('Trip');
    });

    it('opens the picker when the switch button is tapped', () => {
        const { getByTestId, queryByTestId } = render(
            <PriorityGroupSwitcher groupId="g1" groupName="Trip" groups={groups} />,
        );
        // Sheet row not present until opened.
        expect(queryByTestId('group-picker-row-g2')).toBeNull();
        fireEvent.press(getByTestId('priority-switch-btn'));
        expect(getByTestId('group-picker-row-g2')).toBeTruthy();
    });

    it('selecting a group stores it and closes the picker', () => {
        const { getByTestId, queryByTestId } = render(
            <PriorityGroupSwitcher groupId="g1" groupName="Trip" groups={groups} />,
        );
        fireEvent.press(getByTestId('priority-switch-btn'));
        fireEvent.press(getByTestId('group-picker-row-g2'));
        expect(useAppStore.getState().priorityGroupId).toBe('g2');
        // Picker closed → row gone.
        expect(queryByTestId('group-picker-row-g2')).toBeNull();
    });
});
```

- [ ] **Run and expect failure.** Run:

```bash
npx jest __tests__/components/PriorityGroupSwitcher.test.tsx --watchman=false
```

Expect:

```
Cannot find module '../../components/priorityGroup/PriorityGroupSwitcher' from '__tests__/components/PriorityGroupSwitcher.test.tsx'
```

- [ ] **Minimal implementation.** Create `components/priorityGroup/PriorityGroupSwitcher.tsx`:

```tsx
/**
 * PriorityGroupSwitcher — the small "switch group" button shown at the top of
 * the Priority Group tab. Shows the active group's name; tapping opens the
 * GroupPickerSheet, and choosing a group persists it via setPriorityGroupId.
 */
import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupWithMembers } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { useAppStore } from '../../store';
import { GroupPickerSheet } from './GroupPickerSheet';

interface Props {
    /** The effective (resolved) group id currently shown in the tab. */
    groupId: string;
    /** Display name of the effective group. */
    groupName: string;
    /** All member groups, for the picker list. */
    groups: GroupWithMembers[];
}

export function PriorityGroupSwitcher({ groupId, groupName, groups }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const setPriorityGroupId = useAppStore((s) => s.setPriorityGroupId);
    const [pickerOpen, setPickerOpen] = useState(false);

    const handleSelect = useCallback(
        (id: string) => {
            setPriorityGroupId(id);
            setPickerOpen(false);
        },
        [setPriorityGroupId],
    );

    return (
        <View className="px-4 pt-2 pb-1">
            <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('priorityGroup.switchLabel')}
                testID="priority-switch-btn"
                style={rtlRowStyle(isRtl)}
                className="self-start items-center rounded-full bg-gray-100 px-3 h-9"
            >
                <AppIcon name="star" size={16} color={colors.primary} />
                <Text
                    testID="priority-switch-label"
                    className="text-sm font-semibold text-gray-900 mx-2"
                    numberOfLines={1}
                >
                    {groupName}
                </Text>
                <AppIcon name="swap-horizontal" size={16} color={colors.gray500} />
            </TouchableOpacity>

            <GroupPickerSheet
                visible={pickerOpen}
                groups={groups}
                selectedGroupId={groupId}
                onSelectGroup={handleSelect}
                onClose={() => setPickerOpen(false)}
            />
        </View>
    );
}
```

- [ ] **Run and expect pass.** Run:

```bash
npx jest __tests__/components/PriorityGroupSwitcher.test.tsx --watchman=false
```

Expect all 3 cases to pass.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/components/priorityGroup/PriorityGroupSwitcher.tsx \
        cost-share-app/apps/mobile/__tests__/components/PriorityGroupSwitcher.test.tsx
git commit -m "feat(priority-group): add PriorityGroupSwitcher header button

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6 — `PriorityGroupScreen` (tab root: empty-state + switcher + GroupDetail)

**Files:**
- Create: `cost-share-app/apps/mobile/screens/priorityGroup/PriorityGroupScreen.tsx`
- Create (test): `cost-share-app/apps/mobile/__tests__/screens/PriorityGroupScreen.test.tsx`

This screen is the Priority Group stack root. It resolves the effective id via `useEffectivePriorityGroupId`, renders an empty-state (`EmptyState`) with a create CTA when there is no group, and otherwise renders `PriorityGroupSwitcher` above `GroupDetailScreen` fed the effective `groupId`.

**`GroupDetailScreen` reuse — verified.** `GroupDetailScreen` reads its group id from `route.params.groupId` (`screens/groups/GroupDetailScreen.tsx:198-210`) and otherwise pulls everything from queries/store, so it renders standalone given a `groupId`. To feed it a dynamic id without pushing a new route, the screen sets the param on the current route via `navigation.setParams({ groupId })` inside a `useLayoutEffect`, then renders `<GroupDetailScreen />`. Because this screen is the **stack root** named `"PriorityGroupHome"`, `GroupDetailScreen`'s own `navigation.navigate('AddExpense', ...)`, `'SettleUpList'`, `'Balances'`, `'GroupNote'`, `'EditGroup'` calls resolve against the shared root/stack navigators exactly as they do from `GroupsStack` (those routes live on `RootStack` and on the nested stack we register in Task 7). See the "Open risk" note at the end re: `setParams` timing.

In the test we mock `useEffectivePriorityGroupId` and `GroupDetailScreen` so the screen's own branching is what's under test (the real `GroupDetailScreen` is exercised by its own suite). `useGroupsQuery` is seeded via the singleton `queryClient` so the switcher gets its group list. `useNavigation`/`useRoute` are already mocked globally in `jest-setup.ts`.

- [ ] **Write failing test.** Create `__tests__/screens/PriorityGroupScreen.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { GroupWithMembers } from '@cost-share/shared';

// Mock the effective-id hook so we drive the two branches directly.
jest.mock('../../hooks/useEffectivePriorityGroupId', () => ({
    useEffectivePriorityGroupId: jest.fn(),
}));
// Stub GroupDetailScreen — its real behavior is covered by its own suite.
jest.mock('../../screens/groups/GroupDetailScreen', () => ({
    GroupDetailScreen: () => {
        const { Text } = require('react-native');
        return <Text testID="group-detail-stub">detail</Text>;
    },
}));

import { useEffectivePriorityGroupId } from '../../hooks/useEffectivePriorityGroupId';
import { PriorityGroupScreen } from '../../screens/priorityGroup/PriorityGroupScreen';

function makeGroup(id: string, name: string): GroupWithMembers {
    return {
        id,
        name,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

function renderScreen() {
    return render(
        <QueryClientProvider client={queryClient}>
            <PriorityGroupScreen />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    queryClient.clear();
    (useEffectivePriorityGroupId as jest.Mock).mockReset();
});

describe('PriorityGroupScreen', () => {
    it('renders the empty state with a create CTA when there is no group', () => {
        (useEffectivePriorityGroupId as jest.Mock).mockReturnValue(null);
        queryClient.setQueryData(queryKeys.groups, []);
        const { getByTestId, queryByTestId } = renderScreen();
        expect(getByTestId('priority-empty')).toBeTruthy();
        expect(queryByTestId('group-detail-stub')).toBeNull();
    });

    it('renders the switcher + GroupDetail when a group is resolved', () => {
        (useEffectivePriorityGroupId as jest.Mock).mockReturnValue('g1');
        queryClient.setQueryData(queryKeys.groups, [makeGroup('g1', 'Trip')]);
        const { getByTestId } = renderScreen();
        expect(getByTestId('priority-switch-btn')).toBeTruthy();
        expect(getByTestId('priority-switch-label').props.children).toBe('Trip');
        expect(getByTestId('group-detail-stub')).toBeTruthy();
    });
});
```

- [ ] **Run and expect failure.** Run:

```bash
npx jest __tests__/screens/PriorityGroupScreen.test.tsx --watchman=false
```

Expect:

```
Cannot find module '../../screens/priorityGroup/PriorityGroupScreen' from '__tests__/screens/PriorityGroupScreen.test.tsx'
```

- [ ] **Minimal implementation.** Create `screens/priorityGroup/PriorityGroupScreen.tsx`:

```tsx
/**
 * PriorityGroupScreen — root of the Priority Group tab stack.
 *
 * Resolves the effective priority group (stored id or first-group fallback) and:
 *  - no groups at all → empty state with a create-group CTA;
 *  - otherwise → a "switch group" header (PriorityGroupSwitcher) above the
 *    REUSED GroupDetailScreen, fed the effective groupId via route params.
 *
 * GroupDetailScreen reads route.params.groupId, so we push the resolved id onto
 * THIS route's params (not a new navigation) before rendering it.
 */
import React, { useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroupsQuery } from '../../hooks/queries/useGroupsQuery';
import { useEffectivePriorityGroupId } from '../../hooks/useEffectivePriorityGroupId';
import { PriorityGroupSwitcher } from '../../components/priorityGroup/PriorityGroupSwitcher';
import { GroupDetailScreen } from '../groups/GroupDetailScreen';
import { EmptyState } from '../../components/EmptyState';

export function PriorityGroupScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { data: groups = [] } = useGroupsQuery();
    const effectiveGroupId = useEffectivePriorityGroupId();

    const activeGroup = useMemo(
        () => groups.find((g) => g.id === effectiveGroupId) ?? null,
        [groups, effectiveGroupId],
    );

    // Feed GroupDetailScreen the resolved id via this route's params. Runs
    // before paint so GroupDetailScreen reads the right groupId on first render.
    useLayoutEffect(() => {
        if (effectiveGroupId) {
            navigation.setParams({ groupId: effectiveGroupId });
        }
        // TODO(task2): when useMarkGroupSeen from Task 2 is merged, mark the
        // effective group as seen on focus here (spec §משימה 2).
    }, [effectiveGroupId, navigation]);

    if (!effectiveGroupId || !activeGroup) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
                <View testID="priority-empty" className="flex-1">
                    <EmptyState
                        iconName="star-outline"
                        title={t('priorityGroup.emptyTitle')}
                        message={t('priorityGroup.emptyMessage')}
                        actionTitle={t('priorityGroup.emptyCta')}
                        onAction={() => navigation.navigate('CreateGroup')}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <PriorityGroupSwitcher
                groupId={effectiveGroupId}
                groupName={activeGroup.name}
                groups={groups}
            />
            <View className="flex-1">
                <GroupDetailScreen />
            </View>
        </SafeAreaView>
    );
}
```

> Before running, confirm `EmptyState`'s prop names against `components/EmptyState.tsx` — `GroupsListScreen.tsx:377-384` calls it with `iconName`, `title`, `message`, `actionTitle`, `onAction`, so those are correct. If the real signature differs, adjust the call (do not change `EmptyState`).

- [ ] **Run and expect pass.** Run:

```bash
npx jest __tests__/screens/PriorityGroupScreen.test.tsx --watchman=false
```

Expect both cases to pass.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/screens/priorityGroup/PriorityGroupScreen.tsx \
        cost-share-app/apps/mobile/__tests__/screens/PriorityGroupScreen.test.tsx
git commit -m "feat(priority-group): add PriorityGroupScreen tab root reusing GroupDetail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7 — i18n keys (label + strings)

**Files:**
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json` (`tabs` block ~lines 34-39)
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json` (`tabs` block ~lines 34-39)

There is no snapshot test that enforces key parity, so this task is verified by (a) a `tsc`/lint pass and (b) the full suite still passing. Keys must exist in BOTH files with identical shapes.

- [ ] **Add English keys.** In `i18n/locales/en.json`, extend the `tabs` block (add the `priorityGroup` label) and add a new top-level `priorityGroup` object. The `tabs` block becomes:

```json
    "tabs": {
        "groups": "Groups",
        "activity": "Activity",
        "history": "History",
        "profile": "Profile",
        "priorityGroup": "Priority Group"
    },
```

Add a `priorityGroup` object (place it near the other feature blocks, e.g. right after the `tabs` block's closing `},`):

```json
    "priorityGroup": {
        "switchLabel": "Switch group",
        "pickerTitle": "Choose priority group",
        "emptyTitle": "No groups yet",
        "emptyMessage": "Create or join a group to pin it here for quick access.",
        "emptyCta": "Create a group"
    },
```

- [ ] **Add Hebrew keys.** In `i18n/locales/he.json`, extend the `tabs` block:

```json
    "tabs": {
        "groups": "קופות",
        "activity": "פעילות",
        "history": "היסטוריה",
        "profile": "פרופיל",
        "priorityGroup": "קבוצה בעדיפות"
    },
```

Add the Hebrew `priorityGroup` object after the `tabs` block:

```json
    "priorityGroup": {
        "switchLabel": "החלפת קבוצה",
        "pickerTitle": "בחירת קבוצה בעדיפות",
        "emptyTitle": "אין עדיין קבוצות",
        "emptyMessage": "צרו או הצטרפו לקבוצה כדי להצמיד אותה כאן לגישה מהירה.",
        "emptyCta": "יצירת קבוצה"
    },
```

- [ ] **Validate JSON + full suite.** Run:

```bash
node -e "require('./i18n/locales/en.json'); require('./i18n/locales/he.json'); console.log('json ok')"
npx jest __tests__/components/GroupPickerSheet.test.tsx \
         __tests__/components/PriorityGroupSwitcher.test.tsx \
         __tests__/screens/PriorityGroupScreen.test.tsx --watchman=false
```

Expect `json ok` then all three suites passing (the components render the real translated labels; with the jest i18n mock returning keys, tests already pass, and this confirms nothing regressed).

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/i18n/locales/en.json \
        cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "feat(priority-group): add i18n keys for the Priority Group tab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8 — Wire `PriorityGroupStack` + 4th tab into `MainTabs`

**Files:**
- Modify: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx`
  - Import `PriorityGroupScreen` (near the other screen imports ~lines 59-85)
  - Add `PriorityGroupStack` function (mirror `GroupsStack`, ~lines 147-200)
  - Add a 4th `Tab.Screen` in `MainTabs` (~lines 257-327)

`AppNavigator.tsx` is a navigator wiring file — there is no existing unit test for it (confirmed: no `__tests__` file references `AppNavigator`), and the app's convention is to verify navigation manually/preview. So this task is verified by a `tsc` typecheck + running the full test suite to confirm nothing else breaks, then a manual/preview check.

- [ ] **Add the screen import.** In `navigation/AppNavigator.tsx`, after the `GroupDetailScreen` import (line 60) add:

```ts
import { PriorityGroupScreen } from '../screens/priorityGroup/PriorityGroupScreen';
```

- [ ] **Add `PriorityGroupStack`.** After the `GroupsStack` function (ends at line 200) add:

```tsx
function PriorityGroupStack() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <Stack.Navigator screenOptions={buildStackScreenOptions(isRtl)}>
            <Stack.Screen
                name="PriorityGroupHome"
                component={PriorityGroupScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="GroupMembers"
                component={GroupMembersScreen}
                options={{ title: t('groups.members.title') }}
            />
            <Stack.Screen
                name="GroupNote"
                component={GroupNoteScreen}
                options={{ title: t('groups.note.title') }}
            />
            <Stack.Screen
                name="ExpenseList"
                component={ExpenseListScreen}
                options={{ title: t('expenses.title') }}
            />
            <Stack.Screen
                name="ExpenseDetail"
                component={ExpenseDetailScreen}
                options={{ title: t('expenses.expenseDetail') }}
            />
            <Stack.Screen
                name="Balances"
                component={BalancesScreen}
                options={{ title: t('balances.title') }}
            />
            <Stack.Screen
                name="SettleUpList"
                component={SettleUpListScreen}
                options={{ title: t('settleUp.title') }}
            />
            <Stack.Screen
                name="SettlementHistory"
                component={SettlementHistoryScreen}
                options={{ title: t('balances.settlementHistory') }}
            />
        </Stack.Navigator>
    );
}
```

> Rationale: this mirrors `GroupsStack` (line 147) but with `PriorityGroupHome` as the root instead of `GroupsList`+`GroupDetail`. `GroupDetailScreen`'s in-screen `navigation.navigate('SettleUpList'|'Balances'|'GroupNote'|'GroupMembers'|'ExpenseDetail', ...)` targets are registered here so those pushes work inside the Priority tab. `AddExpense`/`EditExpense`/`EditGroup`/`CreateGroup` live on `RootStack` (lines 422-442) and are reachable from any tab, so they need no duplication.

- [ ] **Add the 4th `Tab.Screen`.** In `MainTabs`, insert a new `Tab.Screen` so the final RTL order is **Groups · Activity · [+ later] · Priority · Profile**. In the JSX the screens are declared Profile, Activity, Groups (source order at lines 265-326). The bottom-tab bar renders them in declaration order; for the target RTL visual order, place `PriorityGroup` **between `Activity` and `Groups`** in source. Insert this block immediately BEFORE the `Groups` `Tab.Screen` (before line 318):

```tsx
            <Tab.Screen
                name="PriorityGroup"
                component={PriorityGroupStack}
                listeners={tabPopToTopOnPress('PriorityGroupHome')}
                options={{
                    tabBarLabel: t('tabs.priorityGroup'),
                    tabBarIcon: tabBarIcon('star', 'star-outline'),
                }}
            />
```

> Note on order: the existing source order (Profile, Activity, Groups) with `initialRouteName="Groups"` renders LTR as Profile · Activity · Groups and mirrors under RTL. Inserting `PriorityGroup` before `Groups` yields source order Profile · Activity · PriorityGroup · Groups. Verify the on-device RTL result matches the spec's **קבוצות · פעילות · קבוצה בעדיפות · פרופיל** (Groups · Activity · Priority · Profile) during the manual check below; if the visual order is off, reorder the four `Tab.Screen` declarations (do not touch `initialRouteName`, which must stay `"Groups"`). The center `+` is a LATER feature (Task 4 of the spec) — do not add it here.

- [ ] **Typecheck + full suite.** Run:

```bash
npx tsc --noEmit -p tsconfig.json
npx jest --watchman=false
```

Expect `tsc` to pass (new stack + tab are well-typed) and the full Jest suite to be green (the new suites from Tasks 1-7 plus all pre-existing tests). If a pre-existing flaky worktree failure appears, re-run the single failing file with `--watchman=false`.

- [ ] **Manual/preview verification (RTL).** Launch the app (see `AGENTS.md`) and confirm: (1) a 4th "קבוצה בעדיפות" tab with a star icon appears; (2) tapping it opens the chosen/first group via `GroupDetailScreen`; (3) the top switch button shows the group name and opens the picker; (4) selecting a different group updates the tab and persists across an app restart; (5) with zero groups the empty state + create CTA shows; (6) the bottom-bar order reads Groups · Activity · Priority · Profile in RTL.

- [ ] **Commit.**

```bash
git add cost-share-app/apps/mobile/navigation/AppNavigator.tsx
git commit -m "feat(priority-group): add Priority Group stack + 4th bottom tab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Full suite one more time.**

```bash
cd cost-share-app/apps/mobile
npx jest --watchman=false
```

- [ ] **Typecheck + lint.**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] Confirm persistence: kill/relaunch the app after switching the priority group; the tab must reopen on the chosen group (verifies `partialize` includes `priorityGroupId`).

---

## Open questions / risks

1. **`GroupDetailScreen` as a tab root with dynamic params via `setParams`.** `GroupDetailScreen` reads `route.params.groupId` (`:198-210`) and calls `navigation.setParams({ groupId, focusFeedItem: undefined })` internally (e.g. `:463`), so it expects `groupId` to already be present. `PriorityGroupScreen` sets it in `useLayoutEffect`. There is a one-frame window on first mount where `route.params.groupId` is `undefined` before the layout effect runs; `GroupDetailScreen`'s early `if (!displayGroup) return <EmptyState .../>` guard (`:778`) tolerates this, but if flicker is observed, the cleaner alternative is to pass the id another way — e.g. wrap `GroupDetailScreen` to accept an explicit `groupId` prop, or set the initial param on the `Stack.Screen` via `initialParams`. Flagged for the implementer to confirm on-device; the plan's approach avoids editing `GroupDetailScreen`.

2. **Icon choice.** Using `star` / `star-outline` (Ionicons) via the existing `tabBarIcon(focused, outline)` helper. These are core Ionicons present in every `@expo/vector-icons` build (node_modules was not installed in this worktree to grep the glyphmap, but `star`/`star-outline` are long-standing, ubiquitous Ionicons — same confidence level as the app's existing `people`/`time`/`person`). `pin`/`pin-outline` and `bookmark`/`bookmark-outline` are equally valid fallbacks if a different affordance is preferred; swap the two strings in the `tabBarIcon(...)` call. `AppIcon`'s type is `keyof typeof Ionicons.glyphMap`, so a wrong name would fail `tsc` — the Task 8 typecheck catches any mistake.

3. **Persistence / partialize.** The store persists via a custom SuperJSON+AsyncStorage `storage` and an explicit `partialize` (`store/index.ts:82-99`) that whitelists only `currentUser` + `language`; Task 1 adds `priorityGroupId` to that whitelist. Store `version` stays `1` (adding an optional field is backward-compatible; an old persisted blob simply lacks the key and the initial `null` applies). No migration needed.

4. **Tab visual order under RTL.** `createBottomTabNavigator` renders in declaration order and RN mirrors it under RTL. The plan places `PriorityGroup` before `Groups` in source to land on Groups · Activity · Priority · Profile in RTL, but this must be eyeballed on-device (Task 8 manual step) since RTL tab mirroring can be surprising. Reordering the `Tab.Screen` declarations is the only fix needed if it's off.

5. **Task 2 (mark-seen) coupling.** The spec wants the Priority tab to mark its group seen on focus, but that RPC/hook ships with Task 2. This plan leaves an explicit `TODO(task2)` in `PriorityGroupScreen` rather than a placeholder implementation, so nothing here depends on unmerged code. If Task 2 is already merged at implementation time, add the `useFocusEffect(markGroupSeen(effectiveGroupId))` call and a small test in Task 6.

6. **Shared `useGroupsQuery` cache.** `PriorityGroupScreen`, the switcher, and the resolver all read the same `queryKeys.groups` cache the groups list already populates (seeded pre-navigator by the auth gate). No new fetching is introduced; the tab is cheap.
