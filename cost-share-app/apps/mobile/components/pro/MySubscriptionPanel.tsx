import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MySubscriptionSnapshot, SubscriptionLifecycle } from '@cost-share/shared';
import { Text } from '../AppText';
import { ProBadge } from './ProBadge';
import { Button } from '../Button';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { formatSubscriptionDate } from '../../lib/formatSubscriptionDate';
import {
    openFixPaymentForUser,
    openSubscriptionManagementForUser,
} from '../../lib/openSubscriptionManagement';
import { restorePurchases, isPurchasesConfigured } from '../../services/purchases.service';
import { showAppToast } from '../../lib/appToast';

type Props = Readonly<{
    snapshot: MySubscriptionSnapshot | null | undefined;
    loading?: boolean;
    compact?: boolean;
    onRestoreSuccess?: () => void;
}>;

function statusStyles(lifecycle: SubscriptionLifecycle): { card: string; badge: string } {
    switch (lifecycle) {
        case 'active':
            return {
                card: 'bg-emerald-50 border-emerald-200',
                badge: 'bg-emerald-100 text-emerald-900',
            };
        case 'cancelled_until_expiry':
            return {
                card: 'bg-amber-50 border-amber-200',
                badge: 'bg-amber-100 text-amber-950',
            };
        case 'billing_issue':
            return {
                card: 'bg-red-50 border-red-200',
                badge: 'bg-red-100 text-red-950',
            };
        case 'expired':
            return { card: 'bg-gray-100 border-gray-200', badge: 'bg-gray-200 text-gray-800' };
        default:
            return { card: 'bg-slate-50 border-slate-200', badge: 'bg-slate-200 text-slate-800' };
    }
}

export function MySubscriptionPanel({ snapshot, loading, compact, onRestoreSuccess }: Props) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const [busy, setBusy] = useState(false);
    const storeConfigured = isPurchasesConfigured();

    const planLabel = useMemo(() => {
        if (!snapshot) return t('pro.subscription.planUnknown');
        switch (snapshot.planKind) {
            case 'monthly':
                return t('pro.paywall.planMonthly');
            case 'yearly':
                return t('pro.paywall.planYearly');
            case 'trip_pass':
                return t('pro.paywall.planTripPass');
            default:
                return t('pro.subscription.planUnknown');
        }
    }, [snapshot, t]);

    const storeLabel = useMemo(() => {
        if (!snapshot) return t('pro.subscription.storeUnknown');
        switch (snapshot.store) {
            case 'app_store':
                return t('pro.subscription.storeAppStore');
            case 'play_store':
                return t('pro.subscription.storePlayStore');
            case 'promotional':
                return t('pro.subscription.storePromotional');
            case 'stripe':
                return t('pro.subscription.storeStripe');
            default:
                return t('pro.subscription.storeUnknown');
        }
    }, [snapshot, t]);

    const dateLabel = formatSubscriptionDate(snapshot?.renewalOrExpiryIso, language);

    const lifecycleKey = snapshot?.lifecycle ?? 'none';
    const statusLabel = t(`pro.subscription.status.${lifecycleKey}`);

    const renewalRowLabel = useMemo(() => {
        if (!dateLabel) return null;
        if (snapshot?.lifecycle === 'cancelled_until_expiry' || snapshot?.autoRenew === false) {
            return t('pro.subscription.expiresOn', { date: dateLabel });
        }
        if (snapshot?.lifecycle === 'expired') {
            return t('pro.subscription.expiredOn', { date: dateLabel });
        }
        return t('pro.subscription.renewsOn', { date: dateLabel });
    }, [dateLabel, snapshot?.autoRenew, snapshot?.lifecycle, t]);

    const manage = useCallback(async () => {
        if (!snapshot) {
            await openSubscriptionManagementForUser(language);
            return;
        }
        await openSubscriptionManagementForUser(language, snapshot);
    }, [language, snapshot]);

    const fixPayment = useCallback(async () => {
        if (!snapshot) {
            await openFixPaymentForUser(language);
            return;
        }
        await openFixPaymentForUser(language, snapshot);
    }, [language, snapshot]);

    const restore = useCallback(async () => {
        if (busy || !storeConfigured) return;
        setBusy(true);
        const ok = await restorePurchases('settings');
        setBusy(false);
        if (ok) {
            showAppToast({ type: 'success', titleKey: 'pro.paywall.restoreSuccess' });
            onRestoreSuccess?.();
        } else {
            showAppToast({ type: 'info', titleKey: 'pro.paywall.restoreNone' });
        }
    }, [busy, onRestoreSuccess, storeConfigured]);

    if (loading) {
        return (
            <View className="py-8 items-center" testID="my-subscription-loading">
                <ActivityIndicator />
            </View>
        );
    }

    if (!snapshot) {
        return (
            <View className="px-4 py-4" testID="my-subscription-empty">
                <Text className="text-sm text-gray-600 text-center">{t('pro.subscription.empty')}</Text>
            </View>
        );
    }

    const styles = statusStyles(snapshot.lifecycle);

    return (
        <View className="px-4 py-2" testID="my-subscription-panel">
            <View className={`rounded-2xl border p-4 ${styles.card}`}>
                <View className="flex-row items-center justify-between mb-3">
                    <ProBadge compact />
                    <Text className={`text-xs font-semibold px-2 py-1 rounded-lg ${styles.badge}`}>
                        {statusLabel}
                    </Text>
                </View>

                <Text className="text-lg font-semibold text-gray-900 mb-1">{planLabel}</Text>
                {snapshot.priceString ? (
                    <Text className="text-base text-gray-800 mb-2">{snapshot.priceString}</Text>
                ) : null}

                {renewalRowLabel ? (
                    <Text className="text-sm text-gray-700 mb-1">{renewalRowLabel}</Text>
                ) : null}

                {snapshot.autoRenew != null ? (
                    <Text className="text-sm text-gray-600 mb-1">
                        {snapshot.autoRenew
                            ? t('pro.subscription.autoRenewOn')
                            : t('pro.subscription.autoRenewOff')}
                    </Text>
                ) : null}

                {snapshot.isFreeTrial ? (
                    <Text className="text-sm text-gray-600 mb-1">{t('pro.subscription.trialActive')}</Text>
                ) : null}

                <Text className="text-xs text-gray-500 mt-2">
                    {t('pro.subscription.purchasedVia', { store: storeLabel })}
                </Text>
            </View>

            {snapshot.lifecycle === 'billing_issue' ? (
                <View className="mt-3">
                    <Text className="text-sm text-red-800 mb-2">{t('pro.subscription.billingIssueBody')}</Text>
                    <Button
                        title={t('pro.subscription.fixPayment')}
                        onPress={() => void fixPayment()}
                        variant="primary"
                        fullWidth
                        testID="my-subscription-fix-payment"
                    />
                </View>
            ) : null}

            {snapshot.tripPasses.length > 0 ? (
                <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <Text className="text-sm font-semibold text-gray-900 mb-2">
                        {t('pro.subscription.tripPassSection')}
                    </Text>
                    {snapshot.tripPasses.map(line => {
                        const exp = formatSubscriptionDate(line.expiresAt, language);
                        return (
                            <View key={line.groupId} className="py-2 border-t border-gray-100">
                                <Text className="text-sm font-medium text-gray-900">{line.groupName}</Text>
                                {exp ? (
                                    <Text className="text-xs text-gray-600 mt-1">
                                        {t('pro.subscription.tripPassUntil', { date: exp })}
                                    </Text>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            ) : null}

            {!compact ? (
                <View className="mt-4 gap-2">
                    <Button
                        title={t('pro.settings.manageSubscription')}
                        onPress={() => void manage()}
                        variant="secondary"
                        fullWidth
                        testID="my-subscription-manage"
                    />
                    {storeConfigured ? (
                        <Pressable
                            onPress={() => void restore()}
                            disabled={busy}
                            className="py-3 items-center"
                            testID="my-subscription-restore"
                        >
                            <Text className="text-primary font-semibold">{t('pro.paywall.restore')}</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
