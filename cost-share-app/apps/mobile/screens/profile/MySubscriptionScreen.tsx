import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { APP_WEB_ORIGIN, buildLegalPageUrl } from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { MySubscriptionPanel } from '../../components/pro/MySubscriptionPanel';
import { ProBadge } from '../../components/pro/ProBadge';
import { useMySubscription } from '../../hooks/useMySubscription';
import { useProStatus } from '../../hooks/useProStatus';
import { useShowProUpsell } from '../../hooks/useShowProUpsell';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { queryKeys } from '../../hooks/queries/keys';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { showAppToast } from '../../lib/appToast';
import { Linking } from 'react-native';

const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? APP_WEB_ORIGIN).replace(/\/$/, '');

export function MySubscriptionScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const queryClient = useQueryClient();
    const language = useAppLanguage();
    const { hasPro } = useProStatus();
    const showUpsell = useShowProUpsell();
    const { data, isLoading, refetch } = useMySubscription();
    const [showPurchaseBanner, setShowPurchaseBanner] = useState(
        route.params?.purchaseSuccess === true,
    );
    const proMemberTheme = hasPro || (data != null && data.lifecycle !== 'none');

    useEffect(() => {
        if (route.params?.purchaseSuccess !== true) return;
        setShowPurchaseBanner(true);
        showAppToast({ type: 'success', titleKey: 'pro.paywall.purchaseSuccess' });
        navigation.setParams({ purchaseSuccess: undefined });
    }, [navigation, route.params?.purchaseSuccess]);

    useFocusEffect(
        useCallback(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.proStatus() });
            void queryClient.invalidateQueries({ queryKey: queryKeys.mySubscription() });
            void refetch();
        }, [queryClient, refetch]),
    );

    const openLegal = useCallback(
        (slug: 'terms' | 'privacy') => {
            void Linking.openURL(buildLegalPageUrl(WEB_ORIGIN, slug, language));
        },
        [language],
    );

    if (!KUPAPAY_PRO_ENABLED) {
        return (
            <View className="flex-1 items-center justify-center p-6">
                <Text className="text-gray-600 text-center">{t('pro.subscription.disabled')}</Text>
            </View>
        );
    }

    return (
        <ScrollView
            className={`flex-1 ${proMemberTheme ? 'bg-amber-50/50' : 'bg-slate-50'}`}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            testID="my-subscription-screen"
        >
            {showPurchaseBanner ? (
                <View
                    className="mx-4 mt-4 mb-1 rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3"
                    testID="my-subscription-purchase-success"
                >
                    <View className="flex-row items-center gap-2 mb-1">
                        <ProBadge compact />
                        <Text className="text-base font-semibold text-amber-950">
                            {t('pro.paywall.purchaseSuccess')}
                        </Text>
                    </View>
                    <Text className="text-sm text-amber-900/90 leading-5">
                        {t('pro.subscription.purchaseSuccessHint')}
                    </Text>
                </View>
            ) : null}
            <View className="px-4 pt-4 pb-2">
                <Text className="text-gray-600 text-sm leading-5">{t('pro.subscription.screenIntro')}</Text>
            </View>

            <MySubscriptionPanel
                snapshot={data}
                loading={isLoading}
                onRestoreSuccess={() => void refetch()}
            />

            {showUpsell ? (
                <Pressable
                    className="mx-4 mt-4 py-3 items-center rounded-2xl bg-primary"
                    onPress={() => navigation.navigate('Paywall', { featureKey: 'settings' })}
                    testID="my-subscription-go-pro"
                >
                    <Text className="text-white font-semibold">{t('monetization.goProButton')}</Text>
                </Pressable>
            ) : null}

            <View className="flex-row flex-wrap justify-center gap-4 mt-6 px-4">
                <Pressable onPress={() => openLegal('terms')}>
                    <Text className="text-primary text-sm underline">{t('settings.terms')}</Text>
                </Pressable>
                <Pressable onPress={() => openLegal('privacy')}>
                    <Text className="text-primary text-sm underline">{t('settings.privacy')}</Text>
                </Pressable>
            </View>

            <Text className="text-xs text-gray-500 text-center leading-5 mt-4 px-6">
                {t('pro.subscription.renewalDisclosureShort')}
            </Text>
        </ScrollView>
    );
}
