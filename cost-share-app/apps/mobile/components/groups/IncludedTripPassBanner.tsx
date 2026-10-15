import React, { useCallback, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { useProStatusQuery } from '../../hooks/queries/useProStatusQuery';
import { redeemIncludedTripPass } from '../../services/proEntitlements.service';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { showAppToast } from '../../lib/appToast';

type IncludedTripPassBannerProps = Readonly<{
    groupId: string;
}>;

function includedTripPassErrorKey(
    error: string | undefined,
): 'pro.includedTripPass.inactiveSub' | 'pro.includedTripPass.noCredit' | 'pro.includedTripPass.error' {
    if (error === 'subscription_inactive') return 'pro.includedTripPass.inactiveSub';
    if (error === 'no_credit') return 'pro.includedTripPass.noCredit';
    return 'pro.includedTripPass.error';
}

export function IncludedTripPassBanner({ groupId }: IncludedTripPassBannerProps) {
    const { t } = useTranslation();
    const { data: proStatus, isLoading } = useProStatusQuery(groupId);
    const [busy, setBusy] = useState(false);

    const credits = proStatus?.includedTripPassCredits ?? 0;
    const subActive =
        proStatus?.individualProUntil != null &&
        new Date(proStatus.individualProUntil).getTime() > Date.now();
    const show = KUPAPAY_PRO_ENABLED && !isLoading && credits > 0 && subActive;

    const onRedeem = useCallback(async () => {
        setBusy(true);
        const result = await redeemIncludedTripPass(groupId);
        setBusy(false);
        if (result.ok) {
            showAppToast({ type: 'success', titleKey: 'pro.includedTripPass.redeemed' });
            await queryClient.invalidateQueries({ queryKey: queryKeys.proStatus(groupId) });
            return;
        }
        showAppToast({ type: 'error', titleKey: includedTripPassErrorKey(result.error) });
    }, [groupId]);

    if (!show) return null;

    return (
        <View className="mx-4 mb-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <Text className="text-gray-900 font-semibold mb-1">{t('pro.includedTripPass.title')}</Text>
            <Text className="text-gray-600 text-sm mb-3">{t('pro.includedTripPass.body')}</Text>
            <TouchableOpacity
                onPress={onRedeem}
                disabled={busy}
                className="bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2"
                testID="redeem-included-trip-pass"
            >
                {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
                <Text className="text-white font-semibold">{t('pro.includedTripPass.cta')}</Text>
            </TouchableOpacity>
        </View>
    );
}
