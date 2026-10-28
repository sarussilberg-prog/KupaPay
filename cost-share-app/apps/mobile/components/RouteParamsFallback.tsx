import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';

/**
 * Shown when a stack screen was opened without required route params.
 */
export function RouteParamsFallback() {
    const { t } = useTranslation();
    const navigation = useNavigation<{ canGoBack: () => boolean; goBack: () => void }>();

    const onBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    }, [navigation]);

    const canGoBack = navigation.canGoBack();

    return (
        <View className="flex-1 bg-slate-50" testID="route-params-fallback">
            <EmptyState
                iconName="alert-circle-outline"
                title={t('common.error')}
                message={t('common.loadError')}
                {...(canGoBack
                    ? {
                          actionTitle: t('common.back'),
                          onAction: onBack,
                      }
                    : {})}
            />
        </View>
    );
}
