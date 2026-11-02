import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { deferNonCriticalNativeTask } from './safeNativeModule';

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
    if (Platform.OS === 'web') {
        if (typeof Notification === 'undefined') return Notifications.PermissionStatus.DENIED;
        if (Notification.permission === 'granted') return Notifications.PermissionStatus.GRANTED;
        if (Notification.permission === 'denied') return Notifications.PermissionStatus.DENIED;
        return Notifications.PermissionStatus.UNDETERMINED;
    }
    const { status } = await Notifications.getPermissionsAsync();
    return status;
}

export async function requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
        if (typeof Notification === 'undefined') return false;
        const result = await Notification.requestPermission();
        return result === 'granted';
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

export async function fetchExpoPushToken(): Promise<string | null> {
    const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    try {
        if (Platform.OS === 'web') {
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
                return null;
            }
        }
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

export function currentPlatform(): 'ios' | 'android' | 'web' | null {
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
    if (Platform.OS === 'web') return 'web';
    return null;
}

export function appVersion(): string | undefined {
    return Application.nativeApplicationVersion ?? undefined;
}

async function setBadgeCountWhenPermitted(count: number): Promise<void> {
    if (Platform.OS === 'web') return;
    const status = await getPermissionStatus();
    if (status !== 'granted') {
        return;
    }
    await Notifications.setBadgeCountAsync(Math.max(0, count));
}

export async function setBadgeCount(count: number): Promise<void> {
    try {
        await setBadgeCountWhenPermitted(count);
    } catch {
        /* badge unsupported, permission revoked, or native module error — ignore */
    }
}

/** Clears the home-screen badge after Activity is seen; deferred off the focus critical path. */
export function deferClearAppIconBadge(): void {
    deferNonCriticalNativeTask(() => setBadgeCount(0));
}
