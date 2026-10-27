import { Linking, Platform } from 'react-native';
import { APP_WEB_ORIGIN, buildLegalPageUrl, type Language } from '@cost-share/shared';
import { openSubscriptionManagement as openNativeSubscriptionManagement } from '../services/purchases.service';

const APP_STORE_URL = process.env.EXPO_PUBLIC_APP_STORE_URL;
const PLAY_STORE_URL = process.env.EXPO_PUBLIC_PLAY_STORE_URL;
const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? APP_WEB_ORIGIN).replace(/\/$/, '');

/** Opens App Store / Play subscription management, with web and store-URL fallbacks. */
export async function openSubscriptionManagementForUser(language: Language): Promise<void> {
    if (Platform.OS === 'web') {
        const url = PLAY_STORE_URL ?? APP_STORE_URL ?? buildLegalPageUrl(WEB_ORIGIN, 'terms', language);
        await Linking.openURL(url);
        return;
    }

    await openNativeSubscriptionManagement();
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    if (url) {
        try {
            await Linking.openURL(url);
        } catch {
            // Native sheet may have opened; ignore secondary link failures.
        }
    }
}
