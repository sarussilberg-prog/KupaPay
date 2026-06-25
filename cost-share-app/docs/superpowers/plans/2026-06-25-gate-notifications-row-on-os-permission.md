# Gate the Notifications Settings Row on OS Permission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When OS notifications are off in phone settings, grey out and disable the Notifications row in profile → Settings (blocking entry into the NotificationSettings screen) and show a footer hint linking to device settings; auto-recover when re-enabled.

**Architecture:** A small focused hook reads the expo OS permission status (`denied` only) and refreshes on app-foreground. `SettingsRow` gains a `disabled` prop and `SettingsSection` gains a `footer` prop. `SettingsScreen` moves the Notifications row into its own section and wires both from the hook. The now-unreachable "Open settings" row inside `NotificationSettingsScreen` is removed.

**Tech Stack:** React Native (Expo 55), TypeScript, expo-notifications, react-i18next, nativewind, jest + @testing-library/react-native.

## Global Constraints

- Gate **only** on OS status `'denied'`. `'granted'` and `'undetermined'` must keep the row tappable — the existing on-app-entry permission request flow is unchanged. (`getPermissionStatus()` returns `Notifications.PermissionStatus` = `'granted' | 'denied' | 'undetermined'`, verified in `lib/pushNotifications.ts:25`.)
- Do **not** modify the soft-ask flow (`usePushPermissionPrompt`, `EnableNotificationsBanner`) or the in-app `pushEnabled`/category toggles.
- Link color for in-text links uses `style={{ color: colors.primary }}` (established pattern, e.g. `EnableNotificationsBanner.tsx:30`).
- i18n: every new user-facing string gets both `en.json` and `he.json` keys under the existing `notifications` block.
- Tests run with `npm test -- <path>` (jest, preset `jest-expo`). In tests `t(key)` returns the key verbatim, so assert on raw keys (e.g. `'notifications.title'`).
- Commit after each task.

---

## File Structure

- `hooks/useSystemNotificationsDenied.ts` (new) — reads OS permission, returns `boolean`, refreshes on foreground.
- `components/settings/NotificationsDisabledHint.tsx` (new) — footer caption + inline "Go to settings" link.
- `components/settings/SettingsRow.tsx` (modify) — add `disabled?: boolean`.
- `components/settings/SettingsSection.tsx` (modify) — add `footer?: ReactNode`.
- `screens/profile/SettingsScreen.tsx` (modify) — own Notifications section + wiring + testID.
- `screens/profile/NotificationSettingsScreen.tsx` (modify) — remove inner "Open settings" section + unused `Linking` import.
- `i18n/locales/en.json`, `i18n/locales/he.json` (modify) — 2 keys each.
- Tests alongside each.

---

### Task 1: `useSystemNotificationsDenied` hook

**Files:**
- Create: `hooks/useSystemNotificationsDenied.ts`
- Test: `__tests__/hooks/useSystemNotificationsDenied.test.ts`

**Interfaces:**
- Consumes: `getPermissionStatus()` from `lib/pushNotifications` → `Promise<'granted' | 'denied' | 'undetermined'>`.
- Produces: `useSystemNotificationsDenied(): boolean` — `true` only when OS status is `'denied'`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useSystemNotificationsDenied.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useSystemNotificationsDenied } from '../../hooks/useSystemNotificationsDenied';
import { getPermissionStatus } from '../../lib/pushNotifications';

jest.mock('../../lib/pushNotifications', () => ({
    getPermissionStatus: jest.fn(),
}));

const mockGetPermissionStatus = getPermissionStatus as jest.MockedFunction<typeof getPermissionStatus>;

describe('useSystemNotificationsDenied', () => {
    let appStateHandler: (s: string) => void;

    beforeEach(() => {
        mockGetPermissionStatus.mockReset();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
            appStateHandler = handler as (s: string) => void;
            return { remove: jest.fn() } as any;
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it('returns false when permission is granted', async () => {
        mockGetPermissionStatus.mockResolvedValue('granted' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('returns true when permission is denied', async () => {
        mockGetPermissionStatus.mockResolvedValue('denied' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(true));
    });

    it('returns false when permission is undetermined', async () => {
        mockGetPermissionStatus.mockResolvedValue('undetermined' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('re-checks when the app returns to foreground', async () => {
        mockGetPermissionStatus.mockResolvedValue('denied' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(true));

        mockGetPermissionStatus.mockResolvedValue('granted' as any);
        await act(async () => { appStateHandler('active'); });
        await waitFor(() => expect(result.current).toBe(false));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/useSystemNotificationsDenied.test.ts`
Expected: FAIL — "Cannot find module '../../hooks/useSystemNotificationsDenied'".

- [ ] **Step 3: Write minimal implementation**

Create `hooks/useSystemNotificationsDenied.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPermissionStatus } from '../lib/pushNotifications';

// True only when the OS reports notifications are off in phone settings ('denied').
// 'undetermined' (never asked) stays false so the app's request-on-entry flow runs.
export function useSystemNotificationsDenied(): boolean {
    const [denied, setDenied] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setDenied((await getPermissionStatus()) === 'denied');
        } catch {
            /* keep current state on failure — never wrongly block the user */
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    // Re-check on foreground so re-enabling notifications in OS Settings un-greys
    // the row without an app restart.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') void refresh();
        });
        return () => sub.remove();
    }, [refresh]);

    return denied;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/hooks/useSystemNotificationsDenied.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useSystemNotificationsDenied.ts apps/mobile/__tests__/hooks/useSystemNotificationsDenied.test.ts
git commit -m "feat(notifications): add useSystemNotificationsDenied hook"
```

---

### Task 2: `SettingsRow` — `disabled` prop

**Files:**
- Modify: `components/settings/SettingsRow.tsx`
- Test: `__tests__/components/settings/SettingsRow.test.tsx`

**Interfaces:**
- Produces: `SettingsRow` accepts optional `disabled?: boolean`; when true, `onPress` does not fire and the row renders greyed (`opacity: 0.45`).

- [ ] **Step 1: Write the failing test**

Append inside the `describe('SettingsRow', ...)` block in `__tests__/components/settings/SettingsRow.test.tsx`:

```tsx
    it('disabled: onPress does not fire', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <SettingsRow iconName="notifications-outline" label="Notifications" variant="chevron" onPress={onPress} disabled />,
        );
        fireEvent.press(getByText('Notifications'));
        expect(onPress).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/settings/SettingsRow.test.tsx`
Expected: FAIL — `onPress` is called (no `disabled` support yet), and/or TS error on the unknown `disabled` prop.

- [ ] **Step 3: Write minimal implementation**

In `components/settings/SettingsRow.tsx`, add `disabled` to `BaseProps`, destructure it, and apply to the `TouchableOpacity` + container:

```tsx
interface BaseProps {
    iconName: AppIconName;
    label: string;
    testID?: string;
    disabled?: boolean;
}
```

```tsx
export function SettingsRow(props: Props) {
    const { iconName, label, testID, disabled } = props;
    const isRtl = useRtlLayout();
    const isDanger = props.variant === 'danger';
    const iconColor = isDanger ? colors.error : colors.gray500;
    const textColor = isDanger ? 'text-red-600' : 'text-gray-900';

    return (
        <TouchableOpacity onPress={props.onPress} testID={testID} disabled={disabled}>
            <View
                className="flex-row items-center bg-white px-4 py-3.5 min-h-[52px]"
                style={disabled ? { opacity: 0.45 } : undefined}
            >
                <AppIcon name={iconName} size={22} color={iconColor} />
                <Text className={`flex-1 ms-3 text-base ${textColor}`}>{label}</Text>
                {props.variant === 'value' ? (
                    <Text className="text-sm text-gray-500 me-2">{props.valueText}</Text>
                ) : null}
                <AppIcon
                    name={isRtl ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color={colors.gray400}
                />
            </View>
        </TouchableOpacity>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/settings/SettingsRow.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/settings/SettingsRow.tsx apps/mobile/__tests__/components/settings/SettingsRow.test.tsx
git commit -m "feat(settings): support disabled SettingsRow"
```

---

### Task 3: `SettingsSection` — `footer` prop

**Files:**
- Modify: `components/settings/SettingsSection.tsx`
- Test: `__tests__/components/settings/SettingsSection.test.tsx`

**Interfaces:**
- Produces: `SettingsSection` accepts optional `footer?: React.ReactNode`, rendered below the card. When absent, nothing extra renders.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('SettingsSection', ...)` block in `__tests__/components/settings/SettingsSection.test.tsx`:

```tsx
    it('renders a footer node below the card when provided', () => {
        const { getByText } = render(
            <SettingsSection title="General" footer={<Text>Footer hint</Text>}>
                <Text>Inside</Text>
            </SettingsSection>,
        );
        expect(getByText('Footer hint')).toBeTruthy();
    });

    it('renders no footer when footer is omitted', () => {
        const { queryByText } = render(
            <SettingsSection title="General"><Text>Inside</Text></SettingsSection>,
        );
        expect(queryByText('Footer hint')).toBeNull();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/settings/SettingsSection.test.tsx`
Expected: FAIL — "Footer hint" not found (and/or TS error on unknown `footer` prop).

- [ ] **Step 3: Write minimal implementation**

Replace the body of `components/settings/SettingsSection.tsx`:

```tsx
import { Text } from '../AppText';
import React from 'react';
import { View } from 'react-native';

interface Props { title: string; children: React.ReactNode; footer?: React.ReactNode; }

export function SettingsSection({ title, children, footer }: Props) {
    return (
        <View className="mb-6">
            <Text className="px-5 mb-2 text-xs font-semibold uppercase text-gray-500">{title}</Text>
            <View className="mx-4 rounded-2xl overflow-hidden border border-gray-100 bg-white">{children}</View>
            {footer ? <View className="px-5 mt-2">{footer}</View> : null}
        </View>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/settings/SettingsSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/settings/SettingsSection.tsx apps/mobile/__tests__/components/settings/SettingsSection.test.tsx
git commit -m "feat(settings): support optional SettingsSection footer"
```

---

### Task 4: i18n keys + `NotificationsDisabledHint` component

**Files:**
- Modify: `i18n/locales/en.json`, `i18n/locales/he.json`
- Create: `components/settings/NotificationsDisabledHint.tsx`
- Test: `__tests__/components/settings/NotificationsDisabledHint.test.tsx`

**Interfaces:**
- Consumes: i18n keys `notifications.systemDisabledHint`, `notifications.goToSettings`; `Linking.openSettings()`.
- Produces: `<NotificationsDisabledHint />` — caption text + inline pressable link (testID `notifications-go-to-settings`) that calls `Linking.openSettings()`.

- [ ] **Step 1: Add the i18n keys**

In `i18n/locales/en.json`, inside the `"notifications"` block (the one near line 992, with `"openSettings"`), add after `"openSettings"`:

```json
        "systemDisabledHint": "To update these settings, first turn on notifications in your device settings.",
        "goToSettings": "Go to settings",
```

In `i18n/locales/he.json`, inside the matching `"notifications"` block (near line 1025), add after `"openSettings"`:

```json
        "systemDisabledHint": "כדי לעדכן הגדרות אלו, יש להפעיל תחילה התראות בהגדרות המכשיר.",
        "goToSettings": "מעבר להגדרות",
```

(Ensure trailing commas are valid JSON — both keys precede later keys like `"primingTitle"`.)

- [ ] **Step 2: Write the failing test**

Create `__tests__/components/settings/NotificationsDisabledHint.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { NotificationsDisabledHint } from '../../../components/settings/NotificationsDisabledHint';

describe('NotificationsDisabledHint', () => {
    it('renders the hint and the go-to-settings link', () => {
        const { getByText, getByTestId } = render(<NotificationsDisabledHint />);
        expect(getByText('notifications.systemDisabledHint')).toBeTruthy();
        expect(getByTestId('notifications-go-to-settings')).toBeTruthy();
    });

    it('opens OS settings when the link is pressed', () => {
        const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as any);
        const { getByTestId } = render(<NotificationsDisabledHint />);
        fireEvent.press(getByTestId('notifications-go-to-settings'));
        expect(openSettings).toHaveBeenCalledTimes(1);
        openSettings.mockRestore();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- __tests__/components/settings/NotificationsDisabledHint.test.tsx`
Expected: FAIL — "Cannot find module '.../NotificationsDisabledHint'".

- [ ] **Step 4: Write minimal implementation**

Create `components/settings/NotificationsDisabledHint.tsx`:

```tsx
import { Text } from '../AppText';
import React from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme';

// Footer shown under the Notifications row when OS notifications are off.
// The inline link jumps to device settings so the user can re-enable them.
export function NotificationsDisabledHint() {
    const { t } = useTranslation();
    return (
        <Text className="text-xs text-gray-500">
            {t('notifications.systemDisabledHint')}{' '}
            <Text
                className="text-xs font-semibold"
                style={{ color: colors.primary }}
                testID="notifications-go-to-settings"
                onPress={() => { void Linking.openSettings(); }}
            >
                {t('notifications.goToSettings')}
            </Text>
        </Text>
    );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/components/settings/NotificationsDisabledHint.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/settings/NotificationsDisabledHint.tsx apps/mobile/__tests__/components/settings/NotificationsDisabledHint.test.tsx apps/mobile/i18n/locales/en.json apps/mobile/i18n/locales/he.json
git commit -m "feat(notifications): add NotificationsDisabledHint footer + i18n"
```

---

### Task 5: Wire the gate into `SettingsScreen`

**Files:**
- Modify: `screens/profile/SettingsScreen.tsx`
- Test: `__tests__/screens/profile/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `useSystemNotificationsDenied()` (Task 1), `NotificationsDisabledHint` (Task 4), `SettingsSection` `footer` (Task 3), `SettingsRow` `disabled` + `testID` (Task 2).
- Produces: Notifications row carries `testID="settings-notifications-row"`; lives in its own section; disabled + footer when denied.

- [ ] **Step 1: Write the failing test**

In `__tests__/screens/profile/SettingsScreen.test.tsx`, add a hook mock near the other `jest.mock` calls (before the `import { SettingsScreen }` line):

```tsx
const mockUseSystemNotificationsDenied = jest.fn(() => false);
jest.mock('../../../hooks/useSystemNotificationsDenied', () => ({
    useSystemNotificationsDenied: () => mockUseSystemNotificationsDenied(),
}));
```

Add `mockUseSystemNotificationsDenied.mockReturnValue(false);` to the end of the existing `beforeEach`.

Then add a new describe block at the end of the file:

```tsx
describe('SettingsScreen — notifications gating', () => {
    it('navigates to NotificationSettings when notifications are allowed', () => {
        mockUseSystemNotificationsDenied.mockReturnValue(false);
        const { getByTestId, queryByText } = render(<SettingsScreen />);
        fireEvent.press(getByTestId('settings-notifications-row'));
        expect(mockNavigate).toHaveBeenCalledWith('NotificationSettings');
        expect(queryByText('notifications.systemDisabledHint')).toBeNull();
    });

    it('blocks navigation and shows the hint when notifications are denied', () => {
        mockUseSystemNotificationsDenied.mockReturnValue(true);
        const { getByTestId, getByText } = render(<SettingsScreen />);
        fireEvent.press(getByTestId('settings-notifications-row'));
        expect(mockNavigate).not.toHaveBeenCalledWith('NotificationSettings');
        expect(getByText('notifications.systemDisabledHint')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/screens/profile/SettingsScreen.test.tsx`
Expected: FAIL — no element with testID `settings-notifications-row` / hint not rendered.

- [ ] **Step 3: Write minimal implementation**

In `screens/profile/SettingsScreen.tsx`:

Add imports:

```tsx
import { useSystemNotificationsDenied } from '../../hooks/useSystemNotificationsDenied';
import { NotificationsDisabledHint } from '../../components/settings/NotificationsDisabledHint';
```

Inside the component, after the other hooks (e.g. after `const navigation = useNavigation<any>();`):

```tsx
    const notificationsDenied = useSystemNotificationsDenied();
```

Remove the Notifications `SettingsRow` from the General section (delete the block at current lines 140-145), so the General section ends after the currency row. Then insert a new dedicated section immediately after the closing `</SettingsSection>` of General (before the admin section):

```tsx
                <SettingsSection
                    title={t('notifications.title')}
                    footer={notificationsDenied ? <NotificationsDisabledHint /> : undefined}
                >
                    <SettingsRow
                        iconName="notifications-outline"
                        label={t('notifications.title')}
                        variant="chevron"
                        disabled={notificationsDenied}
                        onPress={() => navigation.navigate('NotificationSettings')}
                        testID="settings-notifications-row"
                    />
                </SettingsSection>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/screens/profile/SettingsScreen.test.tsx`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/screens/profile/SettingsScreen.tsx apps/mobile/__tests__/screens/profile/SettingsScreen.test.tsx
git commit -m "feat(notifications): gate Settings notifications row on OS permission"
```

---

### Task 6: Remove the now-unreachable "Open settings" row from `NotificationSettingsScreen`

**Files:**
- Modify: `screens/profile/NotificationSettingsScreen.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: the screen no longer renders the standalone "Open settings" `SettingsSection`; the `Linking` import is removed.

- [ ] **Step 1: Remove the section and unused import**

In `screens/profile/NotificationSettingsScreen.tsx`:

Delete the entire trailing `SettingsSection` block (current lines 52-59):

```tsx
                <SettingsSection title="">
                    <SettingsRow
                        iconName="settings-outline"
                        label={t('notifications.openSettings')}
                        variant="chevron"
                        onPress={() => { void Linking.openSettings(); }}
                    />
                </SettingsSection>
```

Remove the now-unused `SettingsRow` import (line 7) and drop `Linking` from the react-native import (line 2), leaving:

```tsx
import { ScrollView, View } from 'react-native';
```

- [ ] **Step 2: Verify it compiles and no other usages broke**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json` (from `cost-share-app/`) — or the project's standard typecheck.
Expected: no errors about unused `Linking`/`SettingsRow` and no missing references.

- [ ] **Step 3: Run the broader settings test suite to confirm nothing regressed**

Run: `npm test -- __tests__/screens/profile __tests__/components/settings`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/screens/profile/NotificationSettingsScreen.tsx
git commit -m "refactor(notifications): drop unreachable Open settings row from NotificationSettings"
```

---

## Final verification

- [ ] Run the full mobile test suite: `npm test` (from `apps/mobile`). Expected: all green.
- [ ] Manual smoke (device/simulator): with OS notifications **off**, the Notifications row in profile → Settings is greyed, non-tappable, and shows the "Go to settings" hint; tapping the link opens OS settings. Re-enable notifications, return to the app → row becomes tappable again without restart. With OS notifications **on** (or never-asked), the row navigates normally.

## Self-Review

- **Spec coverage:** hook (Task 1), `SettingsRow` disabled (Task 2), `SettingsSection` footer (Task 3), hint component + i18n (Task 4), SettingsScreen wiring + own section + gate-on-denied (Task 5), remove inner Open settings row (Task 6). All spec sections mapped.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `useSystemNotificationsDenied(): boolean`, `disabled?: boolean`, `footer?: React.ReactNode`, testIDs `settings-notifications-row` / `notifications-go-to-settings`, i18n keys `notifications.systemDisabledHint` / `notifications.goToSettings` — used identically across tasks.
