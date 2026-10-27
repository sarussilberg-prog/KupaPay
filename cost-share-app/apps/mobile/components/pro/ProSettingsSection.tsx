import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queries/keys';
import {
    isIndividualProActive,
    resolveProMembershipSource,
} from '@cost-share/shared';
import { SettingsSection } from '../settings/SettingsSection';
import { SettingsRow } from '../settings/SettingsRow';
import { Text } from '../AppText';
import { ProBadge } from './ProBadge';
import { useProStatus } from '../../hooks/useProStatus';
import { useShowProUpsell } from '../../hooks/useShowProUpsell';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { openSubscriptionManagementForUser } from '../../lib/openSubscriptionManagement';
import {
    fetchProSubscriptionUiState,
    isPurchasesConfigured,
} from '../../services/purchases.service';

export function ProSettingsSection() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const language = useAppLanguage();
    const queryClient = useQueryClient();
    const { hasPro, data: proStatus } = useProStatus();
    const showUpsell = useShowProUpsell();
    const purchasesReady = isPurchasesConfigured();

    useFocusEffect(
        useCallback(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.proStatus() });
        }, [queryClient]),
    );

    const [proSubUi, setProSubUi] = useState<{
        isInFreeTrial: boolean;
        trialEndsAt: string | null;
    }>({ isInFreeTrial: false, trialEndsAt: null });

    useEffect(() => {
        if (!KUPAPAY_PRO_ENABLED || !purchasesReady) return;
        let cancelled = false;
        void fetchProSubscriptionUiState().then(state => {
            if (!cancelled) {
                setProSubUi({
                    isInFreeTrial: state.isInFreeTrial,
                    trialEndsAt: state.trialEndsAt,
                });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [purchasesReady]);

    const formatDate = useCallback(
        (iso: string | null | undefined) => {
            if (!iso) return null;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return null;
            const locale =
                language === 'he'
                    ? 'he-IL'
                    : language === 'ar'
                      ? 'ar'
                      : language === 'ru'
                        ? 'ru-RU'
                        : language === 'de'
                          ? 'de-DE'
                          : language === 'fr'
                            ? 'fr-FR'
                            : language === 'es'
                              ? 'es-ES'
                              : 'en-US';
            return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
        },
        [language],
    );

    const trialEndsLabel = formatDate(proSubUi.trialEndsAt);
    const individualUntilLabel = formatDate(proStatus?.individualProUntil ?? null);

    const membershipSource = useMemo(
        () => (proStatus ? resolveProMembershipSource(proStatus) : 'none'),
        [proStatus],
    );

    const sectionFooter = useMemo(() => {
        if (hasPro && proSubUi.isInFreeTrial && trialEndsLabel) {
            return (
                <Text className="text-xs text-gray-500 px-4 pb-2">
                    {t('pro.settings.freeTrialUntil', { date: trialEndsLabel })}
                </Text>
            );
        }
        if (hasPro && isIndividualProActive(proStatus ?? {}) && individualUntilLabel) {
            return (
                <View className="px-4 pb-2 flex-row items-center gap-2">
                    <ProBadge compact />
                    <Text className="text-xs text-gray-600 flex-1">
                        {membershipSource === 'both'
                            ? t('pro.settings.activeIndividualAndGroup')
                            : t('pro.settings.activeUntil', { date: individualUntilLabel })}
                    </Text>
                </View>
            );
        }
        if (hasPro) {
            return (
                <View className="px-4 pb-2">
                    <ProBadge compact />
                </View>
            );
        }
        return undefined;
    }, [
        hasPro,
        individualUntilLabel,
        membershipSource,
        proStatus,
        proSubUi.isInFreeTrial,
        t,
        trialEndsLabel,
    ]);

    if (!KUPAPAY_PRO_ENABLED) return null;
    if (!hasPro && !purchasesReady) return null;

    return (
        <SettingsSection title={t('pro.settings.sectionTitle')} footer={sectionFooter}>
            <SettingsRow
                iconName="card-outline"
                label={t('pro.settings.manageSubscription')}
                variant="chevron"
                onPress={() => {
                    void openSubscriptionManagementForUser(language);
                }}
                testID="settings-manage-subscription"
            />
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
