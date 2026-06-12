import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

// Foreground display: show a banner unless the caller suppresses it.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
    }),
});

export async function ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
    });
}

export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
}

export async function requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

// Returns the Expo push token, or null if permission is missing / fetch fails.
export async function fetchExpoPushToken(): Promise<string | null> {
    const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    try {
        await ensureAndroidChannel();
        const { data } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined,
        );
        return data ?? null;
    } catch (e) {
        console.warn('fetchExpoPushToken failed', e);
        return null;
    }
}

export function currentPlatform(): 'ios' | 'android' | null {
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
    return null;
}

export function appVersion(): string | undefined {
    return Application.nativeApplicationVersion ?? undefined;
}

export async function setBadgeCount(count: number): Promise<void> {
    try {
        await Notifications.setBadgeCountAsync(Math.max(0, count));
    } catch {
        /* badge unsupported on some Android launchers — ignore */
    }
}
