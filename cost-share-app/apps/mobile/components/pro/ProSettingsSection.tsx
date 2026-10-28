import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queries/keys';
import { SettingsSection } from '../settings/SettingsSection';
import { SettingsRow } from '../settings/SettingsRow';
import { MySubscriptionPanel } from './MySubscriptionPanel';
import { useProStatus } from '../../hooks/useProStatus';
import { useMySubscription } from '../../hooks/useMySubscription';
import { useShowProUpsell } from '../../hooks/useShowProUpsell';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { isPurchasesConfigured } from '../../services/purchases.service';

export function ProSettingsSection() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const queryClient = useQueryClient();
    const { hasPro } = useProStatus();
    const showUpsell = useShowProUpsell();
    const purchasesReady = isPurchasesConfigured();
    const { data: subscription, isLoading, refetch } = useMySubscription();

    useFocusEffect(
        useCallback(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.proStatus() });
            void queryClient.invalidateQueries({ queryKey: queryKeys.mySubscription() });
            void refetch();
        }, [queryClient, refetch]),
    );

    if (!KUPAPAY_PRO_ENABLED) return null;
    if (!hasPro && !purchasesReady && !subscription) return null;

    const showPanel = hasPro || subscription != null;

    return (
        <SettingsSection title={t('pro.subscription.sectionTitle')}>
            {showPanel ? (
                <View className="pb-2">
                    <MySubscriptionPanel
                        snapshot={subscription}
                        loading={isLoading}
                        compact
                        onRestoreSuccess={() => void refetch()}
                    />
                </View>
            ) : null}
            <SettingsRow
                iconName="card-outline"
                label={t('pro.subscription.openDetails')}
                variant="chevron"
                onPress={() => navigation.navigate('MySubscription')}
                testID="settings-my-subscription"
            />
            {hasPro || subscription != null ? (
                <SettingsRow
                    iconName="settings-outline"
                    label={t('pro.settings.manageSubscription')}
                    variant="chevron"
                    onPress={() => navigation.navigate('MySubscription')}
                    testID="settings-manage-subscription"
                />
            ) : null}
            {showUpsell ? (
                <SettingsRow
                    iconName="star-outline"
                    label={t('monetization.goProButton')}
                    variant="chevron"
                    onPress={() => navigation.navigate('Paywall', { featureKey: 'settings' })}
                    testID="settings-go-pro"
                />
            ) : null}
        </SettingsSection>
    );
}
