import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '../store';
import { notificationDataToPendingNavigation, type NotificationData } from '../lib/pushTapRouting';

function handleTap(data: NotificationData): void {
    const pending = notificationDataToPendingNavigation(data);
    if (pending) useAppStore.getState().setPendingNavigation(pending);
}

// Wired once at the navigation root. Tap handling reuses the existing pendingNavigation flush,
// so it works for both warm taps and cold starts. No-op on web — expo-notifications APIs are native-only.
export function usePushNotificationListeners(): void {
    useEffect(() => {
        if (Platform.OS === 'web') return;

        let sub: { remove: () => void } | undefined;
        try {
            // Cold start: app opened by tapping a notification.
            void Notifications.getLastNotificationResponseAsync()
                .then((response) => {
                    const data = response?.notification.request.content.data as
                        | NotificationData
                        | undefined;
                    if (data) handleTap(data);
                })
                .catch(() => {
                    // Native module unavailable (e.g. web / incomplete link) — ignore.
                });

            sub = Notifications.addNotificationResponseReceivedListener((response) => {
                handleTap(response.notification.request.content.data as NotificationData);
            });
        } catch {
            // expo-notifications not linked on this platform
        }
        return () => sub?.remove();
    }, []);
}
