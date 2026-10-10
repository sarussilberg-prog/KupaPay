import React, { useCallback, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { useProStatusQuery } from '../../hooks/queries/useProStatusQuery';
import { assignPurchasedTripPass } from '../../services/proEntitlements.service';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { showAppToast } from '../../lib/appToast';

interface UnassignedTripPassBannerProps {
    groupId: string;
}

export function UnassignedTripPassBanner({ groupId }: UnassignedTripPassBannerProps) {
    const { t } = useTranslation();
    const { data: proStatus, isLoading } = useProStatusQuery(groupId);
    const [busy, setBusy] = useState(false);

    const count = proStatus?.unassignedTripPassCount ?? 0;
    const show = KUPAPAY_PRO_ENABLED && !isLoading && count > 0;

    const onAssign = useCallback(async () => {
        setBusy(true);
        const result = await assignPurchasedTripPass(groupId);
        setBusy(false);
        if (result.ok) {
            showAppToast({ type: 'success', titleKey: 'pro.unassignedTripPass.assigned' });
            await queryClient.invalidateQueries({ queryKey: queryKeys.proStatus(groupId) });
            return;
        }
        const key =
            result.error === 'no_unassigned_pass'
                ? 'pro.unassignedTripPass.none'
                : 'pro.unassignedTripPass.error';
        showAppToast({ type: 'error', titleKey: key });
    }, [groupId]);

    if (!show) return null;

    return (
        <View className="mx-4 mb-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <Text className="text-gray-900 font-semibold mb-1">
                {t('pro.unassignedTripPass.title')}
            </Text>
            <Text className="text-gray-600 text-sm mb-3">
                {t('pro.unassignedTripPass.body', { count })}
            </Text>
            <TouchableOpacity
                onPress={onAssign}
                disabled={busy}
                className="bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2"
                testID="assign-unassigned-trip-pass"
            >
                {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
                <Text className="text-white font-semibold">{t('pro.unassignedTripPass.cta')}</Text>
            </TouchableOpacity>
        </View>
    );
}
