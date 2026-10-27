import React, { useCallback } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { APP_WEB_ORIGIN, buildLegalPageUrl } from '@cost-share/shared';
import { Text } from '../../components/AppText';
import { MySubscriptionPanel } from '../../components/pro/MySubscriptionPanel';
import { useMySubscription } from '../../hooks/useMySubscription';
import { useShowProUpsell } from '../../hooks/useShowProUpsell';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { queryKeys } from '../../hooks/queries/keys';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { Linking } from 'react-native';

const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? APP_WEB_ORIGIN).replace(/\/$/, '');

export function MySubscriptionScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const queryClient = useQueryClient();
    const language = useAppLanguage();
    const showUpsell = useShowProUpsell();
    const { data, isLoading, refetch } = useMySubscription();

    useFocusEffect(
        useCallback(() => {
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
            className="flex-1 bg-slate-50"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            testID="my-subscription-screen"
        >
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
