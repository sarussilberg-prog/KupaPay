# Center + Quick-Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Depends on:** Task 3 (Priority Group tab + `priorityGroupId` state + 4-tab layout).

**Goal:** Add a raised center "+" FAB to a custom bottom tab bar that opens the existing Add Expense screen pre-seeded with the user's Priority Group, and make the target group editable from a small control at the top of the Add Expense screen — while every other field stays editable exactly as today.

**Architecture:** Replace the default `@react-navigation/bottom-tabs` tab bar with a custom `tabBar` component (`CustomTabBar`) rendered via `tabBar={props => <CustomTabBar {...props} />}` in `MainTabs`. `CustomTabBar` lays out the 4 Task-3 tabs balanced 2/2 around a raised primary-gradient "+" FAB, is RTL-aware (true centering via a fixed-flex-basis center slot, no directional bias), and reads `priorityGroupId` from the Zustand store to `navigation.navigate('AddExpense', { groupId: priorityGroupId })`. Inside `AddExpenseScreen`, the existing `resolvedGroupId` state (line 170) becomes the single source of truth for the target group; a new `GroupSelectPill` at the top of the hero opens a reusable group-picker sheet (`GroupSelectSheet`, built on `BottomSheetShell`) that updates `resolvedGroupId`, which cascades through the existing effects to recompute members, currency, payer, and split defaults.

**Tech Stack:** Expo RN 0.81, `@react-navigation/bottom-tabs` v7 (`BottomTabBarProps`), `@react-navigation/native-stack`, `expo-linear-gradient`, Zustand (`store/index.ts`), TanStack Query, NativeWind, `react-i18next`, Jest + `@testing-library/react-native` (`jest-expo` preset). RTL via `useRtlLayout()`.

---

## File Structure

| File | Created / Modified | Responsibility |
|---|---|---|
| `cost-share-app/apps/mobile/components/navigation/CustomTabBar.tsx` | **Created** | Custom `tabBar` rendering the 4 Task-3 tabs balanced around a raised center "+" FAB; RTL-aware; navigates to `AddExpense` with `priorityGroupId`. |
| `cost-share-app/apps/mobile/components/navigation/CenterAddButton.tsx` | **Created** | Presentational raised "+" FAB (primary gradient, shadow/elevation), extracted so it can be unit-tested and reused. |
| `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` | Modified (`MainTabs`, ~252-328) | Wire `tabBar={props => <CustomTabBar {...props} />}` onto `Tab.Navigator`; keep the badge logic living in `CustomTabBar`. |
| `cost-share-app/apps/mobile/components/expenseV2/GroupSelectPill.tsx` | **Created** | Compact, editable group control (avatar + name + chevron) shown at the top of the Add Expense hero. |
| `cost-share-app/apps/mobile/components/expenseV2/GroupSelectSheet.tsx` | **Created** | Group-picker bottom sheet (reuses `BottomSheetShell` + `GroupAvatar`), lists the user's groups, calls back with the chosen `groupId`. |
| `cost-share-app/apps/mobile/screens/expenses/AddExpenseScreen.tsx` | Modified (~166-244, ~764-830) | Render `GroupSelectPill` at the top of the hero (create mode only); wire it to `setResolvedGroupId`; verify defaults recompute on group change. |
| `cost-share-app/apps/mobile/i18n/locales/en.json` / `he.json` | Modified | New keys: `expenses.v2.changeGroup`, `expenses.v2.selectGroup`, `tabs.priority` (if not already added by Task 3), `expenses.v2.addQuick` a11y label. |
| `cost-share-app/apps/mobile/__tests__/components/CenterAddButton.test.tsx` | **Created** | Unit test for the FAB (renders "+", fires `onPress`). |
| `cost-share-app/apps/mobile/__tests__/components/CustomTabBar.test.tsx` | **Created** | Renders the tabs + center FAB, balanced 2/2, RTL centering, "+" navigates with `priorityGroupId`. |
| `cost-share-app/apps/mobile/__tests__/components/GroupSelectSheet.test.tsx` | **Created** | Lists groups, selecting one fires `onSelect(groupId)`. |
| `cost-share-app/apps/mobile/__tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx` | **Created** | Opening from "+" seeds priority group; switching group in-screen recomputes currency/members and still publishes via the mutation. |

> **Test runner note (worktree):** Jest/Watchman is flaky in git worktrees. **Always** run tests with `--watchman=false`. All commands below already include it. Run from `cost-share-app/apps/mobile`.

---

## Dependencies from Task 3 (do not re-specify — reference only)

Task 3 is assumed complete and must provide, before this plan starts:

1. **Store field** in `cost-share-app/apps/mobile/store/index.ts`:
   - `priorityGroupId: string | null` (persisted via the existing `partialize`, added to the `AppState` interface and initial state), with `setPriorityGroupId: (id: string | null) => void`.
   - A selector-safe default: when `priorityGroupId` is empty/invalid, callers resolve to the first group in `useGroupsQuery().data`.
2. **The 4th tab** ("Priority Group") registered inside `MainTabs` in `navigation/AppNavigator.tsx`, with its own stack whose root is `GroupDetailScreen` seeded from `priorityGroupId`.
3. **Tab layout** already at 4 `Tab.Screen`s: **Groups · Activity · Priority · Profile** (RTL order per spec).
4. **i18n** `tabs.priority` key (en/he).

> Current `store/index.ts` (read at plan time) has **no** `priorityGroupId` — confirm Task 3 landed it before starting. Current `MainTabs` (read at plan time) has **3** tabs (Profile/Activity/Groups). This plan wires the custom `tabBar` onto whatever `MainTabs` looks like after Task 3; if a step's diff context doesn't match, re-read `MainTabs` and adapt the anchor, not the intent.

---

## Task 1 — `CenterAddButton` (presentational raised "+" FAB)

Extract the raised "+" as a standalone presentational component first (YAGNI-minimal, testable in isolation) so `CustomTabBar` composes it. Style matches the app's existing FAB (`components/GroupDetailFloatingActions.tsx` — `borderRadius`, iOS shadow / Android `elevation`, `colors.primary`) and gradient usage (`expo-linear-gradient`, as in `AddExpenseScreen.tsx:34` and `components/GroupAvatar.tsx`).

**Files:**
- Create: `cost-share-app/apps/mobile/components/navigation/CenterAddButton.tsx`
- Test: `cost-share-app/apps/mobile/__tests__/components/CenterAddButton.test.tsx`

**Steps:**

- [ ] **Write the failing test.** Create `cost-share-app/apps/mobile/__tests__/components/CenterAddButton.test.tsx`:

  ```tsx
  import React from 'react';
  import { render, fireEvent } from '@testing-library/react-native';
  import { CenterAddButton } from '../../components/navigation/CenterAddButton';

  describe('CenterAddButton', () => {
      it('renders the add icon and fires onPress', () => {
          const onPress = jest.fn();
          const { getByTestId } = render(<CenterAddButton onPress={onPress} />);
          fireEvent.press(getByTestId('center-add-button'));
          expect(onPress).toHaveBeenCalledTimes(1);
      });

      it('exposes an accessibility label from i18n', () => {
          const { getByLabelText } = render(<CenterAddButton onPress={jest.fn()} />);
          // react-i18next is stubbed in jest-setup.ts to return the key.
          expect(getByLabelText('expenses.v2.addQuick')).toBeTruthy();
      });
  });
  ```

- [ ] **Run it and confirm it fails on the missing module.**

  ```bash
  npx jest __tests__/components/CenterAddButton.test.tsx --watchman=false
  ```

  Expect (module doesn't exist yet):

  ```
  Cannot find module '../../components/navigation/CenterAddButton' from '__tests__/components/CenterAddButton.test.tsx'
  ```

- [ ] **Add the i18n key.** In `cost-share-app/apps/mobile/i18n/locales/en.json`, under `expenses.v2`, add `"addQuick": "Add expense"`. In `he.json`, add `"addQuick": "הוספת הוצאה"`. (Keys are returned verbatim by the test stub, so the value doesn't affect tests — but ship real copy.)

- [ ] **Implement the minimal component.** Create `cost-share-app/apps/mobile/components/navigation/CenterAddButton.tsx`:

  ```tsx
  /**
   * CenterAddButton — the raised primary-gradient "+" FAB that sits in the
   * middle of the custom tab bar, lifted slightly above it. Presentational
   * only: the tab bar owns the navigation side-effect.
   */
  import React from 'react';
  import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { useTranslation } from 'react-i18next';
  import { AppIcon } from '../AppIcon';
  import { colors } from '../../theme';

  /** Diameter of the raised FAB (px). */
  export const CENTER_ADD_SIZE = 58;
  /** How far the FAB is lifted above the tab bar's top edge (px). */
  export const CENTER_ADD_LIFT = 18;

  interface CenterAddButtonProps {
      onPress: () => void;
  }

  export function CenterAddButton({ onPress }: CenterAddButtonProps) {
      const { t } = useTranslation();
      return (
          <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('expenses.v2.addQuick')}
              testID="center-add-button"
              style={styles.touchable}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
              <LinearGradient
                  colors={[colors.primaryLight, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradient}
              >
                  <View style={styles.iconWrap}>
                      <AppIcon name="add" size={32} color={colors.white} />
                  </View>
              </LinearGradient>
          </TouchableOpacity>
      );
  }

  const styles = StyleSheet.create({
      touchable: {
          width: CENTER_ADD_SIZE,
          height: CENTER_ADD_SIZE,
          borderRadius: CENTER_ADD_SIZE / 2,
          // Lift above the bar; the tab bar reserves this space via marginTop.
          marginTop: -CENTER_ADD_LIFT,
          ...Platform.select({
              ios: {
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.22,
                  shadowRadius: 8,
              },
              android: { elevation: 8 },
              default: {},
          }),
      },
      gradient: {
          flex: 1,
          borderRadius: CENTER_ADD_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.white,
      },
      iconWrap: {
          alignItems: 'center',
          justifyContent: 'center',
      },
  });
  ```

- [ ] **Run it and confirm both tests pass.**

  ```bash
  npx jest __tests__/components/CenterAddButton.test.tsx --watchman=false
  ```

  Expect:

  ```
  PASS  __tests__/components/CenterAddButton.test.tsx
    CenterAddButton
      ✓ renders the add icon and fires onPress
      ✓ exposes an accessibility label from i18n
  ```

- [ ] **Commit.**

  ```bash
  git add cost-share-app/apps/mobile/components/navigation/CenterAddButton.tsx \
          cost-share-app/apps/mobile/__tests__/components/CenterAddButton.test.tsx \
          cost-share-app/apps/mobile/i18n/locales/en.json \
          cost-share-app/apps/mobile/i18n/locales/he.json
  git commit -m "feat(nav): add raised center + FAB (CenterAddButton)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 2 — `CustomTabBar` (4 tabs balanced around the center "+"), RTL-aware, "+" opens AddExpense seeded with `priorityGroupId`

`CustomTabBar` receives `BottomTabBarProps` (`state`, `descriptors`, `navigation`) and renders each tab from `state.routes` using the route's `tabBarIcon` / `tabBarLabel` from `descriptors[route.key].options`. It inserts the `CenterAddButton` **between the first half and second half** of the tabs so the 4 tabs are balanced 2/2. True centering is achieved by giving the center slot a fixed width equal to `CENTER_ADD_SIZE` and letting the two tab groups each take `flex: 1` — symmetric in both LTR and RTL. RTL ordering is handled by rendering `state.routes` in the same order React Navigation already ordered them (Task 3 defined the RTL order) and relying on the row's `direction` from `useRtlLayout()`; the center slot is index-based (`Math.floor(routes.length / 2)`), so it stays truly centered regardless of direction.

The "+" reads `priorityGroupId` from the store (falling back to the first group id from `useGroupsQuery`) and calls `navigation.navigate('AddExpense', { groupId })`. `AddExpense` is a **modal on the RootStack** (`AppNavigator.tsx:433-437`, `headerShown:false`); from a tab's `navigation` object, `navigate('AddExpense', ...)` resolves up to the RootStack. We use the root navigator via `navigation.getParent()` defensively so the target is found even though `AddExpense` lives above the tab navigator.

The Activity unread badge (currently inline in `AppNavigator.tsx:279-314`) moves into `CustomTabBar` so the custom bar keeps that behavior. (If Task 2's `UnreadBadge` extraction from the spec already landed, reuse `<UnreadBadge />` instead of re-inlining — check for `components/UnreadBadge.tsx` first.)

**Files:**
- Create: `cost-share-app/apps/mobile/components/navigation/CustomTabBar.tsx`
- Test: `cost-share-app/apps/mobile/__tests__/components/CustomTabBar.test.tsx`
- Modify: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` (`MainTabs`, ~252-328)

**Steps:**

- [ ] **Write the failing test.** Create `cost-share-app/apps/mobile/__tests__/components/CustomTabBar.test.tsx`. It builds a minimal `BottomTabBarProps`-shaped object (4 routes) so the component can be rendered without a real navigator:

  ```tsx
  import React from 'react';
  import { Text } from 'react-native';
  import { render, fireEvent } from '@testing-library/react-native';
  import { CustomTabBar } from '../../components/navigation/CustomTabBar';
  import { useAppStore } from '../../store';
  import { queryClient } from '../../lib/queryClient';
  import { queryKeys } from '../../hooks/queries/keys';

  // Silence the Activity unread-count query network dependency.
  jest.mock('../../hooks/queries/useActivityUnreadCount', () => ({
      useActivityUnreadCount: () => ({ data: 0 }),
  }));

  const ROUTE_NAMES = ['Groups', 'Activity', 'Priority', 'Profile'];

  function makeProps(overrides?: {
      navigate?: jest.Mock;
      getParent?: jest.Mock;
      index?: number;
  }) {
      const navigate = overrides?.navigate ?? jest.fn();
      const routes = ROUTE_NAMES.map((name, i) => ({
          key: `${name}-${i}`,
          name,
      }));
      const descriptors = Object.fromEntries(
          routes.map((r) => [
              r.key,
              {
                  options: {
                      tabBarLabel: r.name,
                      tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                          <Text testID={`icon-${r.name}`}>{`${r.name}:${size}:${color}`}</Text>
                      ),
                  },
              },
          ]),
      );
      return {
          state: { index: overrides?.index ?? 0, routes },
          descriptors,
          navigation: {
              navigate: jest.fn(),
              emit: jest.fn(() => ({ defaultPrevented: false })),
              getParent: overrides?.getParent ?? jest.fn(() => ({ navigate })),
          },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
      } as any;
  }

  beforeEach(() => {
      queryClient.clear();
      useAppStore.setState({ language: 'en', priorityGroupId: 'g-priority' } as any);
  });

  describe('CustomTabBar', () => {
      it('renders all four tab labels plus the center add button', () => {
          const { getByText, getByTestId } = render(<CustomTabBar {...makeProps()} />);
          ROUTE_NAMES.forEach((name) => expect(getByText(name)).toBeTruthy());
          expect(getByTestId('center-add-button')).toBeTruthy();
      });

      it('places the center button in the middle (2 tabs each side)', () => {
          const { getByTestId } = render(<CustomTabBar {...makeProps()} />);
          const left = getByTestId('tabbar-side-leading');
          const right = getByTestId('tabbar-side-trailing');
          // Each side wraps exactly two tab buttons.
          expect(left.findAllByProps({ accessibilityRole: 'button' }).length).toBe(2);
          expect(right.findAllByProps({ accessibilityRole: 'button' }).length).toBe(2);
      });

      it('pressing "+" navigates to AddExpense with the priority group id', () => {
          const navigate = jest.fn();
          const getParent = jest.fn(() => ({ navigate }));
          const { getByTestId } = render(
              <CustomTabBar {...makeProps({ getParent })} />,
          );
          fireEvent.press(getByTestId('center-add-button'));
          expect(navigate).toHaveBeenCalledWith('AddExpense', { groupId: 'g-priority' });
      });

      it('falls back to the first group when priorityGroupId is empty', () => {
          useAppStore.setState({ priorityGroupId: null } as any);
          queryClient.setQueryData(queryKeys.groups, [
              { id: 'g-first', name: 'First' },
              { id: 'g-second', name: 'Second' },
          ]);
          const navigate = jest.fn();
          const getParent = jest.fn(() => ({ navigate }));
          const { getByTestId } = render(
              <CustomTabBar {...makeProps({ getParent })} />,
          );
          fireEvent.press(getByTestId('center-add-button'));
          expect(navigate).toHaveBeenCalledWith('AddExpense', { groupId: 'g-first' });
      });

      it('mirrors the row direction in RTL (Hebrew)', () => {
          useAppStore.setState({ language: 'he' } as any);
          const { getByTestId } = render(<CustomTabBar {...makeProps()} />);
          const row = getByTestId('tabbar-row');
          expect(row.props.style).toEqual(
              expect.arrayContaining([
                  expect.objectContaining({ direction: 'rtl' }),
              ]),
          );
      });
  });
  ```

- [ ] **Run it and confirm it fails on the missing module.**

  ```bash
  npx jest __tests__/components/CustomTabBar.test.tsx --watchman=false
  ```

  Expect:

  ```
  Cannot find module '../../components/navigation/CustomTabBar' from '__tests__/components/CustomTabBar.test.tsx'
  ```

- [ ] **Implement `CustomTabBar`.** Create `cost-share-app/apps/mobile/components/navigation/CustomTabBar.tsx`:

  ```tsx
  /**
   * CustomTabBar — replaces the default bottom-tabs bar so we can slot a raised
   * "+" FAB in the true center, with the 4 Task-3 tabs balanced 2/2 around it.
   *
   * Centering strategy (RTL-safe): the two tab groups each take flex:1 and the
   * center slot is a fixed-width column (CENTER_ADD_SIZE). This is symmetric in
   * both LTR and RTL — no directional offset math. Row direction comes from
   * useRtlLayout() so tabs mirror correctly for Hebrew.
   */
  import React from 'react';
  import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
  import { useQueryClient } from '@tanstack/react-query';
  import { colors } from '../../theme';
  import { useRtlLayout } from '../../hooks/useRtlLayout';
  import { useAppStore } from '../../store';
  import { queryKeys } from '../../hooks/queries/keys';
  import { CenterAddButton, CENTER_ADD_SIZE } from './CenterAddButton';
  import { AppIcon } from '../AppIcon';
  import { useActivityUnreadCount } from '../../hooks/queries/useActivityUnreadCount';

  const ICON_SIZE = 24;

  /** Resolve which group the "+" seeds: the priority group, else the first group. */
  function useQuickAddGroupId(): string | undefined {
      const priorityGroupId = useAppStore((s) => s.priorityGroupId);
      const client = useQueryClient();
      if (priorityGroupId) return priorityGroupId;
      const groups =
          client.getQueryData<Array<{ id: string }>>(queryKeys.groups) ?? [];
      return groups[0]?.id;
  }

  export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
      const isRtl = useRtlLayout();
      const insets = useSafeAreaInsets();
      const quickAddGroupId = useQuickAddGroupId();
      const { data: unreadCount = 0 } = useActivityUnreadCount();

      const centerIndex = Math.floor(state.routes.length / 2);

      const onQuickAdd = () => {
          if (!quickAddGroupId) return;
          // AddExpense lives on the RootStack (above the tab navigator); resolve
          // up to the parent so navigate finds the modal route.
          const parent = navigation.getParent?.() ?? navigation;
          parent.navigate('AddExpense', { groupId: quickAddGroupId });
      };

      const renderTab = (route: (typeof state.routes)[number], routeIndex: number) => {
          const { options } = descriptors[route.key];
          const focused = state.index === routeIndex;
          const color = focused ? colors.primary : colors.gray400;
          const label =
              typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;

          const onPress = () => {
              const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
              }
          };

          return (
              <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  testID={`tab-${route.name}`}
                  onPress={onPress}
                  activeOpacity={0.7}
                  style={styles.tab}
              >
                  {options.tabBarIcon
                      ? options.tabBarIcon({ focused, color, size: ICON_SIZE })
                      : (
                          <AppIcon name="ellipse-outline" size={ICON_SIZE} color={color} />
                      )}
                  <Text style={[styles.label, { color }]} numberOfLines={1}>
                      {label}
                  </Text>
              </TouchableOpacity>
          );
      };

      const leading = state.routes.slice(0, centerIndex);
      const trailing = state.routes.slice(centerIndex);

      return (
          <View
              testID="tabbar-row"
              style={[
                  styles.row,
                  { direction: isRtl ? 'rtl' : 'ltr', paddingBottom: insets.bottom },
              ]}
          >
              <View testID="tabbar-side-leading" style={styles.side}>
                  {leading.map((route) =>
                      renderTab(route, state.routes.indexOf(route)),
                  )}
              </View>

              <View style={styles.center}>
                  <CenterAddButton onPress={onQuickAdd} />
              </View>

              <View testID="tabbar-side-trailing" style={styles.side}>
                  {trailing.map((route) =>
                      renderTab(route, state.routes.indexOf(route)),
                  )}
              </View>

              {/* Activity unread badge is rendered by the tab's own icon (see
                  AppNavigator). unreadCount is read here only to keep the count
                  query warm; per-icon badge lives in the icon renderer. */}
              {void unreadCount}
          </View>
      );
  }

  const styles = StyleSheet.create({
      row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.white,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border.default,
          paddingTop: 6,
          ...Platform.select({
              ios: {
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
              },
              android: { elevation: 8 },
              default: {},
          }),
      },
      side: {
          flex: 1,
          flexDirection: 'row',
      },
      tab: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 4,
      },
      label: {
          fontSize: 10,
          marginTop: 2,
      },
      center: {
          width: CENTER_ADD_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
      },
  });
  ```

  > **Note on the badge:** the snippet above keeps the Activity badge inside each tab's `tabBarIcon` (the icon function React Navigation already receives from `MainTabs`). Because Task 3's `MainTabs` still defines `tabBarIcon` per screen, the badge continues to render via that icon function — `CustomTabBar` just calls `options.tabBarIcon(...)`. If you prefer the badge in the bar itself, render it as an absolutely-positioned overlay on the Activity `renderTab`; either is acceptable, keep it DRY with Task 2's `UnreadBadge` if that component exists. Remove the `{void unreadCount}` line if you don't need the warm-keep.

- [ ] **Run it and confirm all `CustomTabBar` tests pass.**

  ```bash
  npx jest __tests__/components/CustomTabBar.test.tsx --watchman=false
  ```

  Expect:

  ```
  PASS  __tests__/components/CustomTabBar.test.tsx
    CustomTabBar
      ✓ renders all four tab labels plus the center add button
      ✓ places the center button in the middle (2 tabs each side)
      ✓ pressing "+" navigates to AddExpense with the priority group id
      ✓ falls back to the first group when priorityGroupId is empty
      ✓ mirrors the row direction in RTL (Hebrew)
  ```

- [ ] **Wire the custom bar into `MainTabs`.** In `cost-share-app/apps/mobile/navigation/AppNavigator.tsx`, import the component near the other component imports (after line 30):

  ```tsx
  import { CustomTabBar } from '../components/navigation/CustomTabBar';
  ```

  Then add the `tabBar` prop to the `Tab.Navigator` in `MainTabs` (currently opens at line 257):

  ```tsx
      return (
          <Tab.Navigator
              initialRouteName="Groups"
              tabBar={(props) => <CustomTabBar {...props} />}
              screenOptions={{
                  tabBarActiveTintColor: colors.primary,
                  tabBarInactiveTintColor: colors.gray400,
                  headerShown: false,
              }}
          >
  ```

  Leave the `Tab.Screen` definitions (including their `tabBarIcon` / `tabBarLabel` and the Activity badge) exactly as Task 3 left them — `CustomTabBar` consumes those options.

- [ ] **Type-check the navigator change** (no dedicated navigator test; rely on tsc + existing screen tests that mount navigation).

  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```

  Expect: no errors (exit code 0). If tsc reports that `priorityGroupId` is missing on the store type, Task 3 hasn't landed — stop and reconcile.

- [ ] **Run the existing navigation-adjacent suite to confirm no regression.**

  ```bash
  npx jest __tests__/navigation __tests__/screens/groups/GroupsListScreen.test.tsx --watchman=false
  ```

  Expect: all pass.

- [ ] **Commit.**

  ```bash
  git add cost-share-app/apps/mobile/components/navigation/CustomTabBar.tsx \
          cost-share-app/apps/mobile/__tests__/components/CustomTabBar.test.tsx \
          cost-share-app/apps/mobile/navigation/AppNavigator.tsx
  git commit -m "feat(nav): custom tab bar with raised + that quick-adds to priority group

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 3 — `GroupSelectSheet` (reusable group-picker bottom sheet)

A bottom sheet listing the user's groups (from `useGroupsQuery`), each row = `GroupAvatar` + name, tapping fires `onSelect(groupId)` and closes. Built on `BottomSheetShell` (`components/BottomSheetShell.tsx`) and mirrors the row pattern from `FriendGroupBalancesSheet.tsx` (`rtlRowStyle`, `GroupAvatar`, chevron). This is the "reuse the group-picker pattern" requirement; it is consumed by `GroupSelectPill` in Task 4.

**Files:**
- Create: `cost-share-app/apps/mobile/components/expenseV2/GroupSelectSheet.tsx`
- Test: `cost-share-app/apps/mobile/__tests__/components/GroupSelectSheet.test.tsx`
- Modify: `i18n/locales/en.json` / `he.json` (add `expenses.v2.selectGroup`).

**Steps:**

- [ ] **Write the failing test.** Create `cost-share-app/apps/mobile/__tests__/components/GroupSelectSheet.test.tsx`:

  ```tsx
  import React from 'react';
  import { render, fireEvent } from '@testing-library/react-native';
  import { GroupSelectSheet } from '../../components/expenseV2/GroupSelectSheet';

  const groups = [
      { id: 'g1', name: 'Trip', groupType: 'trip', imageUrl: null },
      { id: 'g2', name: 'Flat', groupType: 'general', imageUrl: null },
  ];

  describe('GroupSelectSheet', () => {
      it('lists the groups when visible', () => {
          const { getByText } = render(
              <GroupSelectSheet
                  visible
                  groups={groups as any}
                  selectedGroupId="g1"
                  onSelect={jest.fn()}
                  onClose={jest.fn()}
              />,
          );
          expect(getByText('Trip')).toBeTruthy();
          expect(getByText('Flat')).toBeTruthy();
      });

      it('fires onSelect with the tapped group id and closes', () => {
          const onSelect = jest.fn();
          const onClose = jest.fn();
          const { getByTestId } = render(
              <GroupSelectSheet
                  visible
                  groups={groups as any}
                  selectedGroupId="g1"
                  onSelect={onSelect}
                  onClose={onClose}
              />,
          );
          fireEvent.press(getByTestId('group-select-row-g2'));
          expect(onSelect).toHaveBeenCalledWith('g2');
          expect(onClose).toHaveBeenCalledTimes(1);
      });
  });
  ```

- [ ] **Run it and confirm it fails on the missing module.**

  ```bash
  npx jest __tests__/components/GroupSelectSheet.test.tsx --watchman=false
  ```

  Expect:

  ```
  Cannot find module '../../components/expenseV2/GroupSelectSheet' from '__tests__/components/GroupSelectSheet.test.tsx'
  ```

- [ ] **Add i18n keys.** In `en.json` under `expenses.v2`: `"selectGroup": "Select group"`. In `he.json`: `"selectGroup": "בחירת קופה"`.

- [ ] **Implement `GroupSelectSheet`.** Create `cost-share-app/apps/mobile/components/expenseV2/GroupSelectSheet.tsx`:

  ```tsx
  /**
   * GroupSelectSheet — reusable group picker built on BottomSheetShell.
   * Lists the user's groups; tapping a row selects it and closes the sheet.
   * Row layout mirrors FriendGroupBalancesSheet (RTL-aware, GroupAvatar + name).
   */
  import React from 'react';
  import { ScrollView, TouchableOpacity, View } from 'react-native';
  import { useTranslation } from 'react-i18next';
  import type { Group } from '@cost-share/shared';
  import { Text } from '../AppText';
  import { BottomSheetShell } from '../BottomSheetShell';
  import { GroupAvatar } from '../GroupAvatar';
  import { AppIcon } from '../AppIcon';
  import { colors } from '../../theme';
  import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

  interface GroupSelectSheetProps {
      visible: boolean;
      groups: Group[];
      selectedGroupId?: string;
      onSelect: (groupId: string) => void;
      onClose: () => void;
  }

  export function GroupSelectSheet({
      visible,
      groups,
      selectedGroupId,
      onSelect,
      onClose,
  }: GroupSelectSheetProps) {
      const { t } = useTranslation();
      const isRtl = useRtlLayout();

      return (
          <BottomSheetShell
              visible={visible}
              label={t('expenses.v2.selectGroup')}
              onClose={onClose}
          >
              <ScrollView contentContainerStyle={{ paddingVertical: 4 }}>
                  {groups.map((group, idx) => {
                      const isSelected = group.id === selectedGroupId;
                      const isLast = idx === groups.length - 1;
                      return (
                          <TouchableOpacity
                              key={group.id}
                              testID={`group-select-row-${group.id}`}
                              onPress={() => {
                                  onSelect(group.id);
                                  onClose();
                              }}
                              style={rtlRowStyle(isRtl)}
                              className={`items-center px-4 py-3 ${isLast ? '' : 'border-b border-slate-100'}`}
                              accessibilityRole="button"
                          >
                              <GroupAvatar
                                  imageUrl={group.imageUrl}
                                  groupType={group.groupType}
                                  size="sm"
                              />
                              <View style={{ flex: 1, marginHorizontal: 12, minWidth: 0 }}>
                                  <Text
                                      className="text-sm font-medium text-gray-900"
                                      numberOfLines={1}
                                  >
                                      {group.name}
                                  </Text>
                              </View>
                              {isSelected ? (
                                  <AppIcon name="checkmark" size={18} color={colors.primary} />
                              ) : (
                                  <AppIcon
                                      name={isRtl ? 'chevron-back' : 'chevron-forward'}
                                      size={16}
                                      color={colors.gray400}
                                  />
                              )}
                          </TouchableOpacity>
                      );
                  })}
              </ScrollView>
          </BottomSheetShell>
      );
  }
  ```

- [ ] **Run it and confirm both tests pass.**

  ```bash
  npx jest __tests__/components/GroupSelectSheet.test.tsx --watchman=false
  ```

  Expect:

  ```
  PASS  __tests__/components/GroupSelectSheet.test.tsx
    GroupSelectSheet
      ✓ lists the groups when visible
      ✓ fires onSelect with the tapped group id and closes
  ```

- [ ] **Commit.**

  ```bash
  git add cost-share-app/apps/mobile/components/expenseV2/GroupSelectSheet.tsx \
          cost-share-app/apps/mobile/__tests__/components/GroupSelectSheet.test.tsx \
          cost-share-app/apps/mobile/i18n/locales/en.json \
          cost-share-app/apps/mobile/i18n/locales/he.json
  git commit -m "feat(expense): reusable GroupSelectSheet picker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 4 — Editable group control at the top of `AddExpenseScreen` (`GroupSelectPill`), wired to `resolvedGroupId`; verify defaults recompute and the fast path still publishes

`AddExpenseScreen` already stores the target group in `resolvedGroupId` state (line 170, initialized from `route.params.groupId`) with `groupId = resolvedGroupId ?? ''` (line 171). Every dependent value is already derived from `groupId`: `storeGroup` (175-177), `useGroupMembersQuery(groupId)` / `useGroupUsersQuery(groupId)` (213-214), the currency-default effect (240-244), the select-all-members effect (247-252), and `useAddExpenseMutation(groupId)` (179). So switching the group is purely: `setResolvedGroupId(next)` — the existing effects recompute currency and members automatically.

Two things to add:
1. A `GroupSelectPill` at the top of the hero that shows the current group and opens `GroupSelectSheet`.
2. On group change in **create mode**, reset the members-initialized latch so the "select all active members" effect re-runs for the new group. (In edit mode the pill is hidden — you don't move an existing expense between groups here.)

**Files:**
- Create: `cost-share-app/apps/mobile/components/expenseV2/GroupSelectPill.tsx`
- Modify: `cost-share-app/apps/mobile/screens/expenses/AddExpenseScreen.tsx` (imports ~44-50; state/handlers ~166-252; render ~764-770; `styles` ~1059)
- Modify: `i18n/locales/en.json` / `he.json` (add `expenses.v2.changeGroup`).
- Test: `cost-share-app/apps/mobile/__tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx`

**Steps:**

- [ ] **Write the failing test (screen-level).** Create `cost-share-app/apps/mobile/__tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx`. It mirrors the existing `AddExpenseScreen.test.tsx` mocks (two groups, per-group members/currency) and asserts: (a) opening from the priority group shows that group's pill, (b) switching to g2 recomputes currency, (c) the fast path publishes to the switched group.

  ```tsx
  import React from 'react';
  import { fireEvent, waitFor } from '@testing-library/react-native';
  import { renderWithQuery } from '../../helpers/renderWithQuery';

  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  jest.mock('@react-navigation/native', () => {
      const actual = jest.requireActual('@react-navigation/native');
      return {
          ...actual,
          useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
          // Opened from "+": seeded with the priority group g1.
          useRoute: () => ({ params: { groupId: 'g1' } }),
          useFocusEffect: (cb: () => void) => cb(),
          useIsFocused: () => true,
      };
  });

  jest.mock('../../../services/expenses.service', () => ({
      createExpense: jest.fn(),
      updateExpense: jest.fn(),
      deleteExpense: jest.fn(),
      getExpenseWithSplits: jest.fn(),
  }));

  jest.mock('../../../services/groups.service', () => ({
      getGroupMembers: jest.fn(async (groupId: string) =>
          groupId === 'g2'
              ? [
                    { id: 'm3', groupId: 'g2', userId: 'u1', role: 'member', isActive: true, joinedAt: new Date() },
                    { id: 'm4', groupId: 'g2', userId: 'u3', role: 'member', isActive: true, joinedAt: new Date() },
                ]
              : [
                    { id: 'm1', groupId: 'g1', userId: 'u1', role: 'member', isActive: true, joinedAt: new Date() },
                    { id: 'm2', groupId: 'g1', userId: 'u2', role: 'member', isActive: true, joinedAt: new Date() },
                ],
      ),
      getGroupById: jest.fn(),
  }));

  jest.mock('../../../services/users.service', () => ({
      fetchGroupUsers: jest.fn(async (groupId: string) =>
          groupId === 'g2'
              ? [
                    { id: 'u1', name: 'Alice', email: 'a@x.com', inviteToken: 'alice123456', defaultCurrency: 'EUR', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
                    { id: 'u3', name: 'Carol', email: 'c@x.com', inviteToken: 'carol1234567', defaultCurrency: 'EUR', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
                ]
              : [
                    { id: 'u1', name: 'Alice', email: 'a@x.com', inviteToken: 'alice123456', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
                    { id: 'u2', name: 'Bob', email: 'b@x.com', inviteToken: 'bob12345678', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
                ],
      ),
  }));

  import { AddExpenseScreen } from '../../../screens/expenses/AddExpenseScreen';
  import { createExpense } from '../../../services/expenses.service';
  import { useAppStore } from '../../../store';
  import { queryClient } from '../../../lib/queryClient';
  import { queryKeys } from '../../../hooks/queries/keys';

  const mockCreateExpense = createExpense as jest.MockedFunction<typeof createExpense>;

  const groupsSeed = [
      {
          id: 'g1', name: 'Trip', defaultCurrency: 'USD', groupType: 'trip',
          inviteToken: 'trip1234567', createdBy: 'u1', isActive: true,
          isArchivedByMe: false, isAutoArchived: false, createdAt: new Date(), updatedAt: new Date(),
          members: [
              { userId: 'u1', displayName: 'Alice', isActive: true },
              { userId: 'u2', displayName: 'Bob', isActive: true },
          ],
      },
      {
          id: 'g2', name: 'Flat', defaultCurrency: 'EUR', groupType: 'general',
          inviteToken: 'flat1234567', createdBy: 'u1', isActive: true,
          isArchivedByMe: false, isAutoArchived: false, createdAt: new Date(), updatedAt: new Date(),
          members: [
              { userId: 'u1', displayName: 'Alice', isActive: true },
              { userId: 'u3', displayName: 'Carol', isActive: true },
          ],
      },
  ];

  beforeEach(() => {
      mockNavigate.mockClear();
      mockGoBack.mockClear();
      mockCreateExpense.mockReset();
      mockCreateExpense.mockResolvedValue({ id: 'e1' } as any);
      useAppStore.setState({
          language: 'en',
          priorityGroupId: 'g1',
          currentUser: {
              id: 'u1', email: 'a@x.com', name: 'Alice', inviteToken: 'alice123456',
              defaultCurrency: 'USD', language: 'en', isActive: true, isAdmin: false,
              createdAt: new Date(), updatedAt: new Date(),
          },
      } as any);
      queryClient.clear();
      queryClient.setQueryData(queryKeys.groups, groupsSeed);
  });

  describe('AddExpenseScreen — editable group control', () => {
      it('shows the seeded priority group in the pill', async () => {
          const { findByTestId } = renderWithQuery(<AddExpenseScreen />);
          const pill = await findByTestId('add-expense-group-pill');
          expect(pill).toBeTruthy();
          const { findByText } = renderWithQuery(<AddExpenseScreen />);
          expect(await findByText('Trip')).toBeTruthy();
      });

      it('switching group updates the currency default (USD → EUR)', async () => {
          const { findByTestId, findByText } = renderWithQuery(<AddExpenseScreen />);
          // Currency pill starts at USD (g1 default).
          expect(await findByText('USD')).toBeTruthy();
          fireEvent.press(await findByTestId('add-expense-group-pill'));
          fireEvent.press(await findByTestId('group-select-row-g2'));
          await waitFor(async () => {
              expect(await findByText('EUR')).toBeTruthy();
          });
      });

      it('publishes to the switched group via the mutation (fast path)', async () => {
          const { findByTestId } = renderWithQuery(<AddExpenseScreen />);
          fireEvent.press(await findByTestId('add-expense-group-pill'));
          fireEvent.press(await findByTestId('group-select-row-g2'));
          fireEvent.changeText(await findByTestId('description-input'), 'Rent');
          fireEvent.changeText(await findByTestId('amount-display'), '90');
          await waitFor(() =>
              expect((await findByTestId('add-expense-submit')).props.accessibilityState?.disabled).toBe(false),
          );
          fireEvent.press(await findByTestId('add-expense-submit'));
          await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled());
          const dto = mockCreateExpense.mock.calls[0][0];
          expect(dto.groupId).toBe('g2');
          expect(dto.currency).toBe('EUR');
          // Split defaults recomputed for g2's members (u1 + u3), not g1's.
          expect(dto.splits.map((s: any) => s.userId).sort()).toEqual(['u1', 'u3']);
      });
  });
  ```

- [ ] **Run it and confirm it fails** (pill testID doesn't exist yet):

  ```bash
  npx jest __tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx --watchman=false
  ```

  Expect the first test to fail with something like:

  ```
  Unable to find an element with testID: add-expense-group-pill
  ```

- [ ] **Add i18n keys.** In `en.json` under `expenses.v2`: `"changeGroup": "Group"`. In `he.json`: `"changeGroup": "קופה"`.

- [ ] **Implement `GroupSelectPill`.** Create `cost-share-app/apps/mobile/components/expenseV2/GroupSelectPill.tsx`:

  ```tsx
  /**
   * GroupSelectPill — compact, tappable group control shown at the top of the
   * Add Expense hero. Shows the current group (avatar + name); tapping opens the
   * GroupSelectSheeT so the target group can be switched from within the screen.
   */
  import React from 'react';
  import { StyleSheet, TouchableOpacity, View } from 'react-native';
  import { useTranslation } from 'react-i18next';
  import type { GroupType } from '@cost-share/shared';
  import { Text } from '../AppText';
  import { GroupAvatar } from '../GroupAvatar';
  import { AppIcon } from '../AppIcon';
  import { colors } from '../../theme';
  import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

  interface GroupSelectPillProps {
      groupName: string;
      groupType?: GroupType;
      imageUrl?: string | null;
      onPress: () => void;
  }

  export function GroupSelectPill({
      groupName,
      groupType,
      imageUrl,
      onPress,
  }: GroupSelectPillProps) {
      const { t } = useTranslation();
      const isRtl = useRtlLayout();
      return (
          <TouchableOpacity
              testID="add-expense-group-pill"
              onPress={onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('expenses.v2.changeGroup')}
              style={[styles.pill, rtlRowStyle(isRtl)]}
          >
              <GroupAvatar imageUrl={imageUrl} groupType={groupType} size="sm" />
              <View style={styles.textWrap}>
                  <Text style={styles.eyebrow}>{t('expenses.v2.changeGroup')}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                      {groupName}
                  </Text>
              </View>
              <AppIcon name="chevron-down" size={16} color={colors.gray400} />
          </TouchableOpacity>
      );
  }

  const styles = StyleSheet.create({
      pill: {
          alignItems: 'center',
          alignSelf: 'center',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.gray50,
          borderWidth: 1,
          borderColor: colors.border.default,
          maxWidth: '90%',
      },
      textWrap: {
          marginHorizontal: 8,
          minWidth: 0,
          flexShrink: 1,
      },
      eyebrow: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: colors.text.tertiary,
      },
      name: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text.primary,
      },
  });
  ```

  > `GroupAvatar` uses `size="sm"` which is a 48px tile — larger than ideal for a pill. If it looks heavy in preview, add a `size="xs"` variant to `GroupAvatar` (out of scope; flag it). For the plan, `sm` is fine functionally and keeps the change small.

- [ ] **Wire the pill + sheet into `AddExpenseScreen`.** Make four edits in `cost-share-app/apps/mobile/screens/expenses/AddExpenseScreen.tsx`:

  1. **Imports** — after the existing `expenseV2` imports (around line 50) add:

     ```tsx
     import { GroupSelectPill } from '../../components/expenseV2/GroupSelectPill';
     import { GroupSelectSheet } from '../../components/expenseV2/GroupSelectSheet';
     ```

  2. **State** — after the `datePickerVisible` state (line 206) add the sheet-visibility state:

     ```tsx
     const [groupPickerVisible, setGroupPickerVisible] = useState(false);
     ```

  3. **Group-switch handler + re-latch effect** — after the create-mode "default payer" effect (ends line 258) add:

     ```tsx
     // Switching the target group in create mode: reset the members-initialized
     // latch so the "select all active members" effect (below) re-runs for the
     // new group, and clear any unequal-split draft that referenced old members.
     const handleSelectGroup = useCallback((nextGroupId: string) => {
         if (nextGroupId === resolvedGroupId) return;
         setResolvedGroupId(nextGroupId);
         setMembersInitialized(false);
         setSelectedMemberIds([]);
         setUnequalValues({});
         setSplitMode('equal');
     }, [resolvedGroupId]);
     ```

     > `paidBy` stays the current user across the switch (the current user is a member of any group they can pick from, so no reset needed). `currency` recomputes via the existing effect at 240-244 because `storeGroup?.defaultCurrency` changes. Members re-select-all via the existing effect at 247-252 once `membersInitialized` is back to `false`.

  4. **Render the pill** — at the very top of `styles.heroTop` (just before the `CurrencyPill`, line 765), in **create mode only**, add:

     ```tsx
                 <View style={styles.heroTop}>
                     {!isEditMode && storeGroup ? (
                         <>
                             <GroupSelectPill
                                 groupName={storeGroup.name}
                                 groupType={storeGroup.groupType}
                                 imageUrl={storeGroup.imageUrl}
                                 onPress={() => setGroupPickerVisible(true)}
                             />
                             <View style={{ height: 16 }} />
                         </>
                     ) : null}
                     <CurrencyPill
                         currency={currency}
                         onPress={() => setCurrencyPickerVisible(true)}
                     />
     ```

  5. **Render the sheet** — next to the other modals (after `DatePickerPopup`, line 960) add:

     ```tsx
             <GroupSelectSheet
                 visible={groupPickerVisible}
                 groups={groupsQuery.data ?? []}
                 selectedGroupId={resolvedGroupId}
                 onSelect={handleSelectGroup}
                 onClose={() => setGroupPickerVisible(false)}
             />
     ```

  > `handleSubmit` already reads the live `groupId` (line 531) and `addExpense = useAddExpenseMutation(groupId)` (line 179) recomputes when `groupId` changes, so publishing after a switch targets the new group with no further change. Add `useCallback` to the imports if it isn't already there — it is (line 9).

- [ ] **Run the new screen test and confirm it passes.**

  ```bash
  npx jest __tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx --watchman=false
  ```

  Expect:

  ```
  PASS  __tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx
    AddExpenseScreen — editable group control
      ✓ shows the seeded priority group in the pill
      ✓ switching group updates the currency default (USD → EUR)
      ✓ publishes to the switched group via the mutation (fast path)
  ```

- [ ] **Run the existing AddExpense suite to confirm no regression** (the pill only renders in create mode; existing tests use `route.params.groupId = 'g1'` so the pill appears but shouldn't break existing assertions — verify).

  ```bash
  npx jest __tests__/screens/expenses/AddExpenseScreen.test.tsx __tests__/screens/expenses/EditExpenseScreen.test.tsx --watchman=false
  ```

  Expect: all pass. If an existing test now finds two "Trip"/group-name matches, scope its query with `getAllBy*` or a testID — but do **not** weaken existing assertions.

- [ ] **Commit.**

  ```bash
  git add cost-share-app/apps/mobile/components/expenseV2/GroupSelectPill.tsx \
          cost-share-app/apps/mobile/screens/expenses/AddExpenseScreen.tsx \
          cost-share-app/apps/mobile/__tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx \
          cost-share-app/apps/mobile/i18n/locales/en.json \
          cost-share-app/apps/mobile/i18n/locales/he.json
  git commit -m "feat(expense): editable group pill at top of Add Expense; recompute defaults on switch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 5 — Full-suite verification of the fast path and all-fields-editable invariant

Confirm the whole feature end-to-end at the test level: "+" seeds priority group, amount + reason publishes, and payer/split/date/currency/receipt controls remain present and editable (they are unchanged, but assert their presence so a future regression is caught).

**Files:**
- Modify: `cost-share-app/apps/mobile/__tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx` (add one invariant test).

**Steps:**

- [ ] **Add the "all fields still editable" invariant test** to `AddExpenseGroupSwitch.test.tsx`:

  ```tsx
      it('keeps all expense controls editable (payer/split, date, currency, receipt)', async () => {
          const { findByTestId } = renderWithQuery(<AddExpenseScreen />);
          // Group pill (this feature) + every pre-existing control still render.
          expect(await findByTestId('add-expense-group-pill')).toBeTruthy();
          expect(await findByTestId('meta-date')).toBeTruthy();
          expect(await findByTestId('meta-receipt')).toBeTruthy();
          const amount = await findByTestId('amount-display');
          expect(amount.props.editable).not.toBe(false);
          const description = await findByTestId('description-input');
          expect(description.props.editable).not.toBe(false);
      });
  ```

- [ ] **Run it and confirm it passes.**

  ```bash
  npx jest __tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx --watchman=false
  ```

  Expect all four tests green.

- [ ] **Run the full component + navigation + expenses test slice** to confirm nothing regressed across the feature surface.

  ```bash
  npx jest __tests__/components/CenterAddButton.test.tsx \
           __tests__/components/CustomTabBar.test.tsx \
           __tests__/components/GroupSelectSheet.test.tsx \
           __tests__/screens/expenses --watchman=false
  ```

  Expect: all suites pass.

- [ ] **Type-check the whole app.**

  ```bash
  npx tsc --noEmit -p tsconfig.json
  ```

  Expect: exit code 0.

- [ ] **Commit.**

  ```bash
  git add cost-share-app/apps/mobile/__tests__/screens/expenses/AddExpenseGroupSwitch.test.tsx
  git commit -m "test(expense): assert quick-add fast path keeps all fields editable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Manual / preview verification (per spec §אימות, do on device — not automatable)

- [ ] Bottom bar shows 4 tabs balanced 2/2 around a raised gradient "+" that sits slightly above the bar, in both **English (LTR)** and **Hebrew (RTL)** — the "+" is truly centered, tabs are symmetric.
- [ ] Tapping "+" opens Add Expense with the **priority group** already selected, amount focused, keyboard up; typing amount + reason and pressing Save publishes to that group.
- [ ] The group pill at the top switches the group; currency + member list + split update to the new group; payer stays "you".
- [ ] Opening Add Expense from a **specific group** (e.g. the group detail FAB) shows that group in the pill, not the priority group.
- [ ] Edit mode (from an existing expense) does **not** show the group pill.

---

## Open questions / risks

1. **Switching group mid-form — reset policy.** The plan resets `selectedMemberIds`, `unequalValues`, and `splitMode` to defaults on switch (payer stays "you") because members differ between groups and a stale unequal split would be invalid. This is the safe default. If product wants to preserve a typed amount/description across the switch (they're group-independent), the plan already does — only split-related state resets. Confirm this reset policy is acceptable.
2. **RTL centering approach.** The plan centers via a fixed-width center slot + two `flex:1` tab groups (symmetric, no directional math) and sets row `direction` from `useRtlLayout()`. This is the most robust approach; verify on a physical Hebrew device that the "+" is pixel-centered and tabs don't drift.
3. **`AddExpense` is a modal on the RootStack.** `CustomTabBar` navigates via `navigation.getParent()?.navigate('AddExpense', …)` so it resolves up from the tab navigator to the RootStack where `AddExpense` is registered (`AppNavigator.tsx:433`). Confirm `getParent()` returns the RootStack navigator at runtime (it should); the test stubs it, so add a quick device smoke check.
4. **Activity unread badge ownership.** The badge currently lives inside the Activity `Tab.Screen`'s `tabBarIcon` (`AppNavigator.tsx:279-314`). `CustomTabBar` calls `options.tabBarIcon(...)`, so the badge keeps working without moving it. If Task 2 extracted a shared `UnreadBadge`, reuse it rather than the inline version. Decide which owns the badge to avoid duplication.
5. **`priorityGroupId` must exist before this plan runs.** Confirmed absent in `store/index.ts` at plan time — this is Task 3's deliverable. If Task 3 isn't merged, `tsc` will fail at Task 2's navigator step; treat that as the gate.
6. **`GroupAvatar` size in the pill.** `sm` (48px) is slightly large for a pill; an `xs` variant would be cleaner but is out of scope. Flagged, not blocking.
