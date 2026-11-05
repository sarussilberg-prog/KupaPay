import React, { useCallback } from 'react';
import { ScrollView, View, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildAmbassadorReferralUrl, type Language } from '@cost-share/shared';
import {
    fetchMyAmbassadorReferralStats,
    type AmbassadorReferralStats,
} from '../../services/ambassador.service';
import {
    fetchMyReferralStatus,
    referralInviteUrl,
    shareReferralInvite,
    type ReferralStatus,
} from '../../services/referral.service';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import * as Clipboard from 'expo-clipboard';
import { showSuccessMessage } from '../../lib/appToast';
import { Text } from '../../components/AppText';
import {
    appLanguageEdgeTextStyle,
    rtlRowStyle,
    startEdgeColumnStyle,
    startEdgeTextStyle,
    useRtlLayout,
} from '../../hooks/useRtlLayout';

export type ReferralProgramContentProps = {
    data: ReferralStatus;
    ambassadorStats?: AmbassadorReferralStats | null;
    language: Language;
    onShare: () => void;
    onCopy: () => void;
};

export function ReferralProgramContent({
    data,
    ambassadorStats,
    language,
    onShare,
    onCopy,
}: ReferralProgramContentProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    const titleClass = 'text-gray-900 text-lg font-semibold';
    const bodyClass = 'text-gray-600 text-sm mt-2';
    const capClass = 'text-gray-500 text-xs mt-3';

    return (
        <>
            <View className="px-4 pt-4" style={startEdgeColumnStyle} testID="referral-program-content">
                <Text
                    testID="referral-program-title"
                    className={titleClass}
                    style={startEdgeTextStyle(isRtl, titleClass)}
                >
                    {t('referral.title')}
                </Text>
                <Text className={bodyClass} style={startEdgeTextStyle(isRtl, bodyClass)}>
                    {t('referral.body')}
                </Text>
                <Text
                    testID="referral-program-cap-hint"
                    className={capClass}
                    style={startEdgeTextStyle(isRtl, capClass)}
                >
                    {t('referral.capHint', { count: data.rewardsThisYear, cap: data.annualCap })}
                </Text>
            </View>

            <View className="gap-3 px-4 mt-4" style={rtlRowStyle(isRtl)}>
                <Pressable
                    className="flex-1 bg-primary-600 rounded-xl py-3 items-center"
                    onPress={onShare}
                    accessibilityRole="button"
                    testID="referral-program-share-btn"
                >
                    <Text className="text-white font-semibold">{t('referral.shareCta')}</Text>
                </Pressable>
                <Pressable
                    className="flex-1 rounded-xl py-3 items-center border border-slate-200"
                    style={{ backgroundColor: '#ffffff' }}
                    onPress={onCopy}
                    accessibilityRole="button"
                    testID="referral-program-copy-btn"
                >
                    <Text className="font-semibold text-gray-800">{t('referral.copyLink')}</Text>
                </Pressable>
            </View>

            {ambassadorStats?.isAmbassador && ambassadorStats.referralCode ? (
                <View
                    className="px-4 mt-6 bg-white mx-4 rounded-xl border border-slate-200 p-4"
                    style={startEdgeColumnStyle}
                >
                    <Text
                        className="text-gray-900 font-semibold"
                        style={startEdgeTextStyle(isRtl, 'text-gray-900 font-semibold')}
                    >
                        {t('referral.ambassador.title')}
                    </Text>
                    <Text
                        className="text-gray-600 text-sm mt-1"
                        style={startEdgeTextStyle(isRtl, 'text-gray-600 text-sm mt-1')}
                    >
                        {t('referral.ambassador.body')}
                    </Text>
                    <Text
                        className="text-gray-500 text-xs mt-2"
                        style={startEdgeTextStyle(isRtl, 'text-gray-500 text-xs mt-2')}
                    >
                        {t('referral.ambassador.codeLabel')}
                    </Text>
                    <Text
                        className="text-gray-900 font-mono mt-1"
                        style={appLanguageEdgeTextStyle(isRtl, 'text-gray-900 font-mono mt-1')}
                    >
                        {ambassadorStats.referralCode}
                    </Text>
                    <Text
                        className="text-gray-500 text-xs mt-3 break-all"
                        style={appLanguageEdgeTextStyle(isRtl, 'text-gray-500 text-xs mt-3 break-all')}
                    >
                        {buildAmbassadorReferralUrl(ambassadorStats.referralCode, language)}
                    </Text>
                    {typeof ambassadorStats.referralCount === 'number' ? (
                        <Text
                            className="text-gray-600 text-sm mt-3"
                            style={startEdgeTextStyle(isRtl, 'text-gray-600 text-sm mt-3')}
                        >
                            {t('referral.ambassador.referralCount', {
                                count: ambassadorStats.referralCount,
                            })}
                        </Text>
                    ) : null}
                </View>
            ) : null}

            <View className="px-4 mt-6" style={startEdgeColumnStyle}>
                <Text
                    testID="referral-program-status-title"
                    className="text-gray-800 font-medium mb-2"
                    style={startEdgeTextStyle(isRtl, 'text-gray-800 font-medium mb-2')}
                >
                    {t('referral.statusTitle')}
                </Text>
                {data.rewards.length === 0 ? (
                    <Text
                        className="text-gray-500 text-sm"
                        style={startEdgeTextStyle(isRtl, 'text-gray-500 text-sm')}
                    >
                        {t('referral.empty')}
                    </Text>
                ) : (
                    data.rewards.map(row => (
                        <View key={row.referee_id} className="py-2 border-b border-slate-200 w-full">
                            <Text
                                className="text-gray-800 text-sm"
                                style={startEdgeTextStyle(isRtl, 'text-gray-800 text-sm')}
                            >
                                {t(`referral.status.${row.status}`)}
                            </Text>
                        </View>
                    ))
                )}
            </View>
        </>
    );
}

export function ReferralProgramScreen() {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const language = (i18n.language?.split('-')[0] ?? 'en') as Language;
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['referralStatus'],
        queryFn: fetchMyReferralStatus,
        enabled: KUPAPAY_PRO_ENABLED,
    });
    const { data: ambassadorStats } = useQuery({
        queryKey: ['ambassadorReferralStats'],
        queryFn: fetchMyAmbassadorReferralStats,
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
            <ReferralProgramContent
                data={data}
                ambassadorStats={ambassadorStats}
                language={language}
                onShare={() => void onShare()}
                onCopy={() => void onCopy()}
            />
        </ScrollView>
    );
}
