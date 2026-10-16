import React, { useCallback } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchMyReferralStatus, referralInviteUrl, shareReferralInvite } from '../../services/referral.service';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import * as Clipboard from 'expo-clipboard';
import { showSuccessMessage } from '../../lib/appToast';

export function ReferralProgramScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['referralStatus'],
        queryFn: fetchMyReferralStatus,
        enabled: KUPAPAY_PRO_ENABLED,
    });

    const onShare = useCallback(async () => {
        await shareReferralInvite();
        void refetch();
    }, [refetch]);

    const onCopy = useCallback(async () => {
        if (!data) return;
        await Clipboard.setStringAsync(referralInviteUrl(data.inviteToken));
        showSuccessMessage(t('referral.linkCopied'));
    }, [data, t]);

    if (!KUPAPAY_PRO_ENABLED) {
        return (
            <View className="flex-1 items-center justify-center p-6">
                <Text className="text-gray-600 text-center">{t('referral.disabled')}</Text>
            </View>
        );
    }

    if (isLoading || !data) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-slate-50"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
            <View className="px-4 pt-4">
                <Text className="text-gray-900 text-lg font-semibold">{t('referral.title')}</Text>
                <Text className="text-gray-600 text-sm mt-2">{t('referral.body')}</Text>
                <Text className="text-gray-500 text-xs mt-3">
                    {t('referral.capHint', { count: data.rewardsThisYear, cap: data.annualCap })}
                </Text>
            </View>

            <View className="flex-row gap-3 px-4 mt-4">
                <Pressable
                    className="flex-1 bg-primary-600 rounded-xl py-3 items-center"
                    onPress={() => void onShare()}
                    accessibilityRole="button"
                >
                    <Text className="text-white font-semibold">{t('referral.shareCta')}</Text>
                </Pressable>
                <Pressable
                    className="flex-1 bg-white border border-slate-200 rounded-xl py-3 items-center"
                    onPress={() => void onCopy()}
                    accessibilityRole="button"
                >
                    <Text className="text-gray-800 font-semibold">{t('referral.copyLink')}</Text>
                </Pressable>
            </View>

            <View className="px-4 mt-6">
                <Text className="text-gray-800 font-medium mb-2">{t('referral.statusTitle')}</Text>
                {data.rewards.length === 0 ? (
                    <Text className="text-gray-500 text-sm">{t('referral.empty')}</Text>
                ) : (
                    data.rewards.map(row => (
                        <View key={row.referee_id} className="py-2 border-b border-slate-200">
                            <Text className="text-gray-800 text-sm">{t(`referral.status.${row.status}`)}</Text>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
}
