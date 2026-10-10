/**
 * Google AdMob rewarded ads — compliance helpers.
 *
 * - Every ad request uses requestNonPersonalizedAdsOnly (no personalized ads).
 * - We do not call App Tracking Transparency / IDFA APIs; no NSUserTrackingUsageDescription.
 * - EU/EEA/UK: ads are disabled (UMP not integrated); gated features stay usable without ads.
 */

import { Platform } from 'react-native';
import * as Localization from 'expo-localization';

/** Passed to RewardedAd.createForAdRequest — required for NPA. */
export const REWARDED_AD_REQUEST_OPTIONS = {
    requestNonPersonalizedAdsOnly: true,
} as const;

/** ISO 3166-1 alpha-2 — EEA + UK + CH (EU privacy conservative gate). */
const EU_EEA_UK_REGIONS = new Set([
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
    'IS',
    'LI',
    'NO',
    'GB',
    'UK',
    'CH',
]);

export function regionCodeForAdsGate(): string | null {
    const region = Localization.getLocales()[0]?.regionCode;
    if (!region) return null;
    return region.toUpperCase();
}

/**
 * Rewarded AdMob is shown only outside EU/EEA/UK/CH until Google UMP is integrated.
 */
export function isRewardedAdsAllowedInRegion(regionCode?: string | null): boolean {
    const code = (regionCode ?? regionCodeForAdsGate())?.toUpperCase();
    if (!code) return true;
    return !EU_EEA_UK_REGIONS.has(code);
}

let sdkInitStarted = false;

/** Optional SDK init (no ATT). Safe to call multiple times. */
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
