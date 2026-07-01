import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

// Opens the OS settings page for this app's notifications. Android can deep-link
// straight to the notification page; iOS has no public deep-link to that
// sub-page, so it (and any Android failure) falls back to the app settings page.
export async function openAppNotificationSettings(): Promise<void> {
    if (Platform.OS === 'android') {
        try {
            await IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
                { extra: { 'android.provider.extra.APP_PACKAGE': Application.applicationId ?? '' } },
            );
            return;
        } catch {
            /* fall through to the generic app settings page */
        }
    }
    await Linking.openSettings();
}
