import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { logMonetizationEvent } from '../services/monetization.service';
import {
    isRewardedAdsAllowedInRegion,
    REWARDED_AD_REQUEST_OPTIONS,
} from '../lib/rewardedAdsCompliance';

const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

// Lazily import the Google Mobile Ads SDK only on native platforms.
// On web (Expo Go web, SSR, etc.) the package either doesn't exist or
// throws on import — we skip it entirely and fall back to the Pro promo.
let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdEventType: any = null;
let TestIds: any = null;

if (IS_NATIVE) {
    try {
        const pkg = require('react-native-google-mobile-ads');
        RewardedAd = pkg.RewardedAd;
        RewardedAdEventType = pkg.RewardedAdEventType;
        AdEventType = pkg.AdEventType;
        TestIds = pkg.TestIds;
    } catch {
        // Package missing in this build — unavailable flag will handle it
    }
}

const PROD_UNIT_ID = Platform.OS === 'ios'
    ? 'ca-app-pub-8860544182475196/9666348435'
    : 'ca-app-pub-8860544182475196/2901559727';

const AD_UNIT_ID = __DEV__ && TestIds ? TestIds.REWARDED : PROD_UNIT_ID;

export interface UseRewardedAdResult {
    show: () => void;
    earned: boolean;
    loading: boolean;
    /** True when Google ads are not supported (web, error, package missing). */
    unavailable: boolean;
}

export function useRewardedAd(featureKey: string): UseRewardedAdResult {
    // Immediately mark unavailable if not on a native platform or SDK missing
    const nativeSupported = IS_NATIVE && RewardedAd !== null;
    const regionAllowed = isRewardedAdsAllowedInRegion();
    const adsEnabled = nativeSupported && regionAllowed;

    const [loading, setLoading] = useState(adsEnabled);
    const [earned, setEarned] = useState(false);
    const [unavailable, setUnavailable] = useState(!adsEnabled);
    const adRef = useRef<any>(null);

    useEffect(() => {
        if (!adsEnabled) return;

        const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID, {
            ...REWARDED_AD_REQUEST_OPTIONS,
        });
        adRef.current = rewarded;

        const unsubLoaded = rewarded.addAdEventListener(
            RewardedAdEventType.LOADED,
            () => { setLoading(false); },
        );

        const unsubEarned = rewarded.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            () => {
                setEarned(true);
                void logMonetizationEvent(featureKey, 'ad_gate_watch_completed');
            },
        );

        // On error: stop the loading spinner AND mark the ad as unavailable
        // so AdGateStep can fall back to the Pro promo interstitial.
        const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
            setLoading(false);
            setUnavailable(true);
        });

        rewarded.load();

        return () => {
            unsubLoaded();
            unsubEarned();
            unsubError();
            adRef.current = null;
        };
    }, [featureKey, adsEnabled]);

    const show = useCallback(() => {
        const ad = adRef.current;
        if (!ad) return;
        void logMonetizationEvent(featureKey, 'ad_gate_watch_tapped');
        void ad.show();
    }, [featureKey]);

    return { show, earned, loading, unavailable };
}
