import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import {
    fetchProSubscriptionUiState,
    openSubscriptionManagement,
    syncProTrialNudgeToRevenueCat,
} from '../../services/purchases.service';
import {
    markProTrialLifecycleTouchDismissed,
    resolveInAppProTrialTouch,
} from '../../services/proTrialLifecycle.service';
import { captureProductEvent } from '../../lib/productAnalytics';

export function ProTrialLifecycleBanner() {
    const { t, i18n } = useTranslation();
    const [touch, setTouch] = useState<ReturnType<typeof resolveInAppProTrialTouch>>(null);

    useEffect(() => {
        if (!KUPAPAY_PRO_ENABLED) return;
        let cancelled = false;
        void fetchProSubscriptionUiState().then(state => {
            if (cancelled || !state.isInFreeTrial || !state.trialEndsAt) return;
            const resolved = resolveInAppProTrialTouch({
                trialEndsAtIso: state.trialEndsAt,
                lifecycleSent: state.trialLifecycleSent ?? [],
                featureUsage: state.trialFeatureUsage ?? {},
                language: i18n.language,
            });
            setTouch(resolved);
        });
        return () => {
            cancelled = true;
        };
    }, [i18n.language]);

    useEffect(() => {
        if (!touch) return;
        void captureProductEvent('pro_trial_nudge_shown', { touch_day: touch.day });
        void syncProTrialNudgeToRevenueCat(touch.day, 'shown');
    }, [touch?.day]);

    const dismiss = useCallback(async () => {
        if (!touch) return;
        await markProTrialLifecycleTouchDismissed(touch.day);
        void captureProductEvent('pro_trial_nudge_dismissed', { touch_day: touch.day });
        void syncProTrialNudgeToRevenueCat(touch.day, 'dismissed');
        setTouch(null);
    }, [touch]);

    if (!touch) return null;

    return (
        <View className="mx-4 mt-2 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3" testID="pro-trial-lifecycle-banner">
            <Text className="text-indigo-950 font-semibold text-base">{touch.title}</Text>
            <Text className="text-indigo-900 text-sm mt-1">{touch.body}</Text>
            <Text className="text-indigo-700 text-xs mt-2">{t('pro.trialLifecycle.disclosure')}</Text>
            <View className="flex-row gap-3 mt-3">
                <Pressable onPress={() => void openSubscriptionManagement()} accessibilityRole="button">
                    <Text className="text-indigo-700 font-semibold text-sm">{t('pro.trialLifecycle.manage')}</Text>
                </Pressable>
                <Pressable onPress={() => void dismiss()} accessibilityRole="button">
                    <Text className="text-indigo-600 text-sm">{t('notifications.primingLater')}</Text>
                </Pressable>
            </View>
        </View>
    );
}
