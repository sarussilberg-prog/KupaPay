import type { UseRewardedAdResult } from './useRewardedAd';

// AdMob (react-native-google-mobile-ads) is native-only — its specs import
// `codegenNativeComponent`, which crashes the Metro web bundle. Web has no
// rewarded-ad inventory, so this stub keeps the web build alive: the ad is
// reported as unavailable (never loading, never earns) and showing is a
// no-op. The gate's "Go Pro" path still works on web.
export function useRewardedAd(_featureKey: string): UseRewardedAdResult {
    return {
        show: () => {},
        earned: false,
        loading: false,
        unavailable: true,
    };
}

export type { UseRewardedAdResult };
