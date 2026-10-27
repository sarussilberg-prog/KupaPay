import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import { rootNavigationRef } from '../lib/rootNavigationRef';

type Props = {
    onRetry: () => void;
    screenName: string;
};

export function ScreenErrorFallback({ onRetry, screenName }: Props) {
    const { t } = useTranslation();

    const onBack = useCallback(() => {
        if (rootNavigationRef.isReady() && rootNavigationRef.canGoBack()) {
            rootNavigationRef.goBack();
            return;
        }
        onRetry();
    }, [onRetry]);

    return (
        <View
            className="flex-1 bg-slate-50"
            testID="screen-error-fallback"
            accessibilityLabel={t('common.screenErrorTitle')}
        >
            <EmptyState
                iconName="alert-circle-outline"
                title={t('common.screenErrorTitle')}
                message={t('common.screenErrorMessage')}
                actionTitle={t('common.retry')}
                onAction={onRetry}
                secondaryActionTitle={t('common.back')}
                onSecondaryAction={onBack}
            />
            {__DEV__ && screenName ? (
                <View accessibilityElementsHidden testID={`screen-error-name-${screenName}`} />
            ) : null}
        </View>
    );
}
