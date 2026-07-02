import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { logMonetizationEvent } from '../../services/monetization.service';
import { ProPromoInterstitial } from './ProPromoInterstitial';

interface AdGateStepProps {
    active: boolean;
    featureKey: string;
    onCompleted: () => void;
}

// Module-level counter: every 4th gate open shows the Pro promo instead of
// the "Watch Ad" / "Go Pro" buttons. Resets on app restart — intentional.
let gateOpenCount = 0;
const PRO_PROMO_EVERY_N = 4;

/**
 * Ad-gate content. Isolated so that keying it (per sheet-open) gives a fresh
 * useRewardedAd instance — a rewarded ad can only be shown once.
 * Used by both RemindFlowSheet and ConsolidateCurrencySheet.
 *
 * Every 4th open shows a full-screen Pro promo interstitial (5-second countdown,
 * then ✕ / "Continue" to dismiss). Other opens show the normal Watch Ad gate.
 */
export function AdGateStep({ active, featureKey, onCompleted }: AdGateStepProps) {
    const { t } = useTranslation();
    const { show, earned, loading, unavailable } = useRewardedAd(featureKey);
    const [proMessageShown, setProMessageShown] = useState(false);

    // Determine once on mount whether this open is a Pro promo slot
    const [showProPromo] = useState<boolean>(() => {
        gateOpenCount += 1;
        return gateOpenCount % PRO_PROMO_EVERY_N === 0;
    });

    useEffect(() => {
        if (active) void logMonetizationEvent(featureKey, 'ad_gate_shown');
    }, [active, featureKey]);

    // Advance the moment the reward is earned — which happens while the ad is
    // still on screen — so the next step is already rendered when the ad dismisses.
    useEffect(() => {
        if (earned) onCompleted();
    }, [earned, onCompleted]);

    const handleGoPro = () => {
        void logMonetizationEvent(featureKey, 'ad_gate_pro_tapped');
        setProMessageShown(true);
    };

    // ── Pro promo interstitial (every 4th open, OR when ads are unavailable) ─
    if (showProPromo || unavailable) {
        return (
            <ProPromoInterstitial
                visible={active}
                onDismiss={() => {
                    void logMonetizationEvent(featureKey, 'pro_promo_dismissed');
                    onCompleted();
                }}
            />
        );
    }

    // ── Normal gate ─────────────────────────────────────────────────────────
    if (proMessageShown) {
        return (
            <View className="px-4 pb-6 pt-2 gap-4">
                <Text className="text-gray-700 text-base text-center leading-6">
                    {t('monetization.goProWorkingOnIt')}
                </Text>
                <TouchableOpacity
                    onPress={() => show()}
                    disabled={loading}
                    activeOpacity={0.8}
                    className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
                    testID="ad-gate-pro-continue-button"
                >
                    {loading && <ActivityIndicator color="#fff" size="small" />}
                    <Text className="text-white font-semibold text-base text-center">
                        {loading ? t('monetization.loadingAd') : t('monetization.continueBtn')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="px-4 pb-6 pt-2 gap-3">
            <TouchableOpacity
                onPress={() => show()}
                disabled={loading}
                activeOpacity={0.8}
                className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
                testID="ad-gate-watch-button"
            >
                {loading && <ActivityIndicator color="#fff" size="small" />}
                <Text className="text-white font-semibold text-base">
                    {loading ? t('monetization.loadingAd') : t('monetization.watchAdButton')}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleGoPro}
                activeOpacity={0.7}
                className="border border-gray-200 rounded-2xl py-4 flex-row items-center justify-center"
                testID="ad-gate-pro-button"
            >
                <Text className="text-gray-700 font-medium text-base text-center">
                    {t('monetization.goProButton')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
