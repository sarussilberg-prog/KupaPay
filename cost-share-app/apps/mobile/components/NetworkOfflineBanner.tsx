import React, { useCallback, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { useNetworkStatus } from '../lib/networkStatus';
import { retryConnectivitySync } from '../lib/reconnectSync';
import { queryClient } from '../lib/queryClient';
import { useRtlLayout } from '../hooks/useRtlLayout';

export function NetworkOfflineBanner() {
    const { t } = useTranslation();
    const { online } = useNetworkStatus();
    const isRtl = useRtlLayout();
    const [retrying, setRetrying] = useState(false);

    const onRetry = useCallback(async () => {
        setRetrying(true);
        try {
            await retryConnectivitySync(queryClient);
        } finally {
            setRetrying(false);
        }
    }, []);

    if (online) {
        return null;
    }

    return (
        <View
            testID="network-offline-banner"
            accessibilityRole="alert"
            style={{
                flexDirection: isRtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: '#422006',
            }}
        >
            <View style={{ flex: 1, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <Text className="text-xs font-semibold text-amber-100" style={{ flex: 1, textAlign: isRtl ? 'right' : 'left' }}>
                    {t('common.offlineBannerMessage')}
                </Text>
            </View>
            <TouchableOpacity
                onPress={() => void onRetry()}
                disabled={retrying}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                testID="network-offline-banner-retry"
                style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: '#f59e0b',
                    minWidth: 72,
                    alignItems: 'center',
                }}
            >
                {retrying ? (
                    <ActivityIndicator size="small" color="#422006" />
                ) : (
                    <Text className="text-xs font-bold text-amber-950">{t('common.retry')}</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}
