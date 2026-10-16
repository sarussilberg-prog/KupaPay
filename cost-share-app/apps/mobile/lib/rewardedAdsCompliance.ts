/**
 * Google AdMob rewarded ads — compliance helpers.
 *
 * - Every ad request uses requestNonPersonalizedAdsOnly (no personalized ads).
 * - We do not call App Tracking Transparency / IDFA APIs; no NSUserTrackingUsageDescription.
 * - EU/EEA/UK: ads are disabled (UMP not integrated); gated features stay usable without ads.
 */

import * as Localization from 'expo-localization';
import { isEuEeaUkChRegion } from './euEeaUkChRegions';

/** Passed to RewardedAd.createForAdRequest — required for NPA. */
export const REWARDED_AD_REQUEST_OPTIONS = {
    requestNonPersonalizedAdsOnly: true,
} as const;

export function regionCodeForAdsGate(): string | null {
    const region = Localization.getLocales()[0]?.regionCode;
    if (!region) return null;
    return region.toUpperCase();
}

/**
 * Rewarded AdMob is shown only outside EU/EEA/UK/CH until Google UMP is integrated.
 */
export function isRewardedAdsAllowedInRegion(regionCode?: string | null): boolean {
    const code = regionCode ?? regionCodeForAdsGate();
    if (!code) return true;
    return !isEuEeaUkChRegion(code);
}

export { configureRewardedAdsSdk } from './configureRewardedAdsSdk';

