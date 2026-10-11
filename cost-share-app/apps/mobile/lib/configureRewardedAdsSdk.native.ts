import { Platform } from 'react-native';

let sdkInitStarted = false;

/** Optional SDK init (no ATT). Safe to call multiple times. Native only. */
export async function configureRewardedAdsSdk(): Promise<void> {
    if (sdkInitStarted || Platform.OS === 'web') return;
    sdkInitStarted = true;
    try {
        const { default: mobileAds } = require('react-native-google-mobile-ads');
        await mobileAds().setRequestConfiguration({
            tagForUnderAgeOfConsent: false,
            tagForChildDirectedTreatment: false,
        });
        await mobileAds().initialize();
    } catch {
        // Native module missing in tests / Expo Go — hook marks ads unavailable.
    }
}
