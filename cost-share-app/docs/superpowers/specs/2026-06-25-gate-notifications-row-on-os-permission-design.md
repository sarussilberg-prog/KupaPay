# Gate the Notifications settings row on OS permission

**Date:** 2026-06-25
**Status:** Approved (pending spec review)

## Problem

When a user has turned notifications **off in their phone settings**, the in-app
Notifications preference screen is useless — none of the toggles can have any
effect because the OS blocks delivery. Today the app still lets the user tap into
the Notifications screen and flip toggles that silently do nothing.

We want to mirror Gmail's pattern: when OS notifications are off, the
**Notifications row** in profile → Settings is greyed out and non-tappable, with a
hint below it that links to the device settings. Once the user re-enables
notifications at the OS level and returns to the app, the row becomes interactive
again automatically.

## Scope & non-goals

**In scope**
- Grey out + disable the Notifications row in `SettingsScreen` when OS
  notifications are `denied`, blocking navigation into the NotificationSettings
  screen.
- Show a footer hint with a "Go to settings" link (→ `Linking.openSettings()`)
  only while disabled.
- Auto-recover when the user re-enables notifications and returns to foreground.
- Remove the now-unreachable standalone "Open settings" row from inside the
  NotificationSettings screen.

**Explicitly NOT changing**
- The app's existing "request notification permission upon entering the app" /
  soft-ask flow stays exactly as-is.
- The in-app `pushEnabled` master toggle and category toggles inside the
  NotificationSettings screen keep their current behavior.

## Key decision: gate on `denied`, not `undetermined`

expo-notifications exposes three OS states: `granted`, `denied`, `undetermined`.

- `denied` → notifications are **off in phone settings** → **gate (grey out)**.
- `undetermined` → the OS permission was never decided yet; this is the normal
  pre-soft-ask state. The app's request flow must still run, so the row stays
  **tappable**.
- `granted` → normal, tappable.

So: **`systemNotificationsDenied = (status === 'denied')`**. This satisfies the
requirement "only if the notification is off in the phone settings."

## Design

### 1. New hook: `hooks/useSystemNotificationsDenied.ts`

A small, focused hook that returns `boolean` (`true` only when OS status is
`denied`). It refreshes on mount and whenever the app returns to foreground —
the same pattern already used in `usePushPermissionPrompt`, but without the
cooldown/AsyncStorage logic, which is irrelevant here.

```ts
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPermissionStatus } from '../lib/pushNotifications';

export function useSystemNotificationsDenied(): boolean {
    const [denied, setDenied] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setDenied((await getPermissionStatus()) === 'denied');
        } catch {
            /* keep current state on failure */
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') void refresh();
        });
        return () => sub.remove();
    }, [refresh]);

    return denied;
}
```

Default of `false` (assume enabled until proven denied) avoids a flash of a
greyed row on mount; `getPermissionStatus()` resolves quickly and flips it to
`true` only when genuinely denied.

### 2. `SettingsRow.tsx` — add `disabled?: boolean`

When `disabled`:
- Wrap content at reduced opacity (~`0.45`, matching `SettingsToggleRow`'s
  existing disabled style).
- `TouchableOpacity` gets `disabled` so `onPress` is a no-op (navigation blocked).
- Chevron stays rendered but reads as greyed (already `colors.gray400`).

### 3. `SettingsSection.tsx` — add `footer?: React.ReactNode`

Renders an optional caption node **below** the rounded card (outside the white
card, like an iOS grouped-list footer). When `footer` is undefined, nothing extra
renders — existing call sites are unaffected.

```tsx
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

### 4. New component: `components/settings/NotificationsDisabledHint.tsx`

Grey caption text + an inline pressable "Go to settings" that calls
`Linking.openSettings()`. RTL-aware (the inline link must read correctly in
Hebrew). Implemented with a `Text` containing a nested pressable `Text` span so
the link sits inline at the end of the sentence:

```tsx
<Text className="text-xs text-gray-500">
    {t('notifications.systemDisabledHint')}{' '}
    <Text className="text-xs text-primary" onPress={() => { void Linking.openSettings(); }}>
        {t('notifications.goToSettings')}
    </Text>
</Text>
```

### 5. `SettingsScreen.tsx` — wire it up

- Call `const notificationsDenied = useSystemNotificationsDenied();`
- Move the Notifications `SettingsRow` out of the **General** section into its own
  `SettingsSection` titled `t('notifications.title')` (Gmail-style dedicated
  "NOTIFICATIONS" block). General keeps Language + Default currency.
- Pass `disabled={notificationsDenied}` to the row, and
  `footer={notificationsDenied ? <NotificationsDisabledHint /> : undefined}` to the
  section.

### 6. NotificationSettings screen — remove inner "Open settings" row

Delete the bottom `SettingsSection` containing the standalone "Open settings"
`SettingsRow` from `NotificationSettingsScreen.tsx`. The OS-settings affordance now
lives only in the gated footer hint. (The `Linking` import becomes unused there
and is removed.)

### 7. i18n

Add to both `en.json` and `he.json` under `notifications`:

| key | en | he |
|-----|----|----|
| `systemDisabledHint` | "To update these settings, first turn on notifications in your device settings." | "כדי לעדכן הגדרות אלו, יש להפעיל תחילה התראות בהגדרות המכשיר." |
| `goToSettings` | "Go to settings" | "מעבר להגדרות" |

(The existing unused `notifications.systemDisabled` key may be left as-is or
removed; out of scope to chase down.)

## Data flow

```
OS permission (granted/denied/undetermined)
        │  getPermissionStatus()
        ▼
useSystemNotificationsDenied()  ──refresh on mount + AppState 'active'──┐
        │ returns denied:boolean                                       │
        ▼                                                              │
SettingsScreen                                                         │
  ├─ Notifications SettingsRow  disabled={denied}  (press no-op)       │
  └─ SettingsSection footer={denied ? <Hint/> : undefined}            │
                                   │                                   │
                                   ▼ "Go to settings"                  │
                            Linking.openSettings() ───user toggles OS──┘
                                                      then returns → refresh → re-enable
```

## Error handling

- `getPermissionStatus()` failure: caught; hook keeps prior state (defaults to
  not-denied), so the row stays usable rather than wrongly blocking the user.
- `Linking.openSettings()` is fire-and-forget (`void`), consistent with existing
  call sites.

## Testing

- **`useSystemNotificationsDenied`**: mock `getPermissionStatus` → returns `true`
  for `denied`, `false` for `granted`/`undetermined`; verify it re-checks on
  `AppState` `active`.
- **`SettingsRow`**: with `disabled`, `onPress` is not invoked on press; greyed
  style applied.
- **`SettingsScreen`**: when denied, the Notifications row does not navigate on
  press and the hint ("Go to settings") renders; when not denied, tapping
  navigates to `NotificationSettings`. Mock the hook / `getPermissionStatus`.
- **`NotificationSettingsScreen`**: the standalone "Open settings" row is gone.

## Files

- `hooks/useSystemNotificationsDenied.ts` (new)
- `components/settings/NotificationsDisabledHint.tsx` (new)
- `components/settings/SettingsRow.tsx` (add `disabled`)
- `components/settings/SettingsSection.tsx` (add `footer`)
- `screens/profile/SettingsScreen.tsx` (own section + wiring)
- `screens/profile/NotificationSettingsScreen.tsx` (remove inner Open settings row)
- `i18n/locales/en.json`, `i18n/locales/he.json` (2 keys each)
- Tests alongside the above
