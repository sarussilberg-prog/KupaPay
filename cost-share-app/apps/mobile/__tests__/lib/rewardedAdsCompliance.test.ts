import {
    isRewardedAdsAllowedInRegion,
    REWARDED_AD_REQUEST_OPTIONS,
} from '../../lib/rewardedAdsCompliance';

describe('rewardedAdsCompliance', () => {
    it('requests non-personalized ads only', () => {
        expect(REWARDED_AD_REQUEST_OPTIONS.requestNonPersonalizedAdsOnly).toBe(true);
    });

    it('blocks rewarded ads in EU/EEA/UK regions', () => {
        expect(isRewardedAdsAllowedInRegion('DE')).toBe(false);
        expect(isRewardedAdsAllowedInRegion('GB')).toBe(false);
        expect(isRewardedAdsAllowedInRegion('FR')).toBe(false);
    });

    it('allows rewarded ads outside EU/EEA/UK', () => {
        expect(isRewardedAdsAllowedInRegion('IL')).toBe(true);
        expect(isRewardedAdsAllowedInRegion('US')).toBe(true);
    });
});
