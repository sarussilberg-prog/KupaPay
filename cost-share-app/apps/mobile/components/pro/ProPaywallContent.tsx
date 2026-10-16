/**
 * App Store Guideline 3.1.2 compliant paywall (team copy HE+EN, RTL-safe).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { PurchasesPackageLike } from '../../lib/purchasesPackage.types';
import { APP_WEB_ORIGIN, buildLegalPageUrl } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import {
    checkIntroductoryPriceEligibility,
    isPurchasesConfigured,
    loadOfferingPackages,
    openSubscriptionManagement,
    purchasePackage,
    restorePurchases,
    type IntroEligibilityMap,
} from '../../services/purchases.service';
import { planShowsFreeTrial } from '../../lib/proTrialPaywall';
import {
    fetchPaywallOfferings,
    reportPaywallLoadFailed,
    type PaywallLoadFailureReason,
} from '../../lib/paywallOfferingsLoad';
import { logMonetizationEvent } from '../../services/monetization.service';
import { captureProductEvent } from '../../lib/productAnalytics';
import { showAppToast } from '../../lib/appToast';
const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? APP_WEB_ORIGIN).replace(/\/$/, '');
const APP_STORE_URL = process.env.EXPO_PUBLIC_APP_STORE_URL;
const PLAY_STORE_URL = process.env.EXPO_PUBLIC_PLAY_STORE_URL;

type PlanKey = 'monthly' | 'yearly' | 'trip_pass';

function priceLabel(pkg: PurchasesPackageLike | null): string {
    if (!pkg) return '—';
    return pkg.product.priceString;
}

function subscriptionPeriodKey(pkg: PurchasesPackageLike | null): string {
    if (!pkg) return '';
    const id = pkg.product.identifier;
    if (id.includes('yearly') || id.includes('annual')) return 'pro.paywall.periodYear';
    return 'pro.paywall.periodMonth';
}

export interface ProPaywallContentProps {
    featureKey: string;
    groupId?: string;
    showTripPass?: boolean;
    onClose?: () => void;
    onPurchaseSuccess?: () => void;
}

export function ProPaywallContent({
    featureKey,
    groupId,
    showTripPass = true,
    onClose,
    onPurchaseSuccess,
}: Readonly<ProPaywallContentProps>) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<PlanKey>('yearly');
    const [packages, setPackages] = useState<Awaited<ReturnType<typeof loadOfferingPackages>> | null>(
        null,
    );
    const [introEligibility, setIntroEligibility] = useState<IntroEligibilityMap | null>(null);
    const [loadFailedReason, setLoadFailedReason] = useState<PaywallLoadFailureReason | null>(null);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [euDigitalAck, setEuDigitalAck] = useState(false);

    useEffect(() => {
        void logMonetizationEvent(featureKey, 'paywall_viewed');
        void captureProductEvent('paywall_viewed', { feature_key: featureKey, group_id: groupId ?? null });
    }, [featureKey, groupId]);

    const loadOfferings = useCallback(async () => {
        if (!isPurchasesConfigured()) {
            setLoading(false);
            setPackages(null);
            setIntroEligibility(null);
            setLoadFailedReason(null);
            return;
        }
        setLoading(true);
        setLoadFailedReason(null);
        const result = await fetchPaywallOfferings({
            loadPackages: loadOfferingPackages,
            checkEligibility: checkIntroductoryPriceEligibility,
        });
        if (result.status === 'ready') {
            setPackages(result.packages);
            setIntroEligibility(result.introEligibility);
            setLoadFailedReason(null);
        } else {
            setPackages(null);
            setIntroEligibility(null);
            setLoadFailedReason(result.reason);
            await reportPaywallLoadFailed({
                featureKey,
                groupId,
                reason: result.reason,
                detail: result.detail,
            });
        }
        setLoading(false);
    }, [featureKey, groupId]);

    useEffect(() => {
        void loadOfferings();
    }, [loadOfferings, loadAttempt]);

    const retryLoad = useCallback(() => {
        setLoadAttempt(n => n + 1);
    }, []);

    const selectedPackage = useMemo((): PurchasesPackageLike | null => {
        if (!packages) return null;
        if (selected === 'monthly') return packages.monthly;
        if (selected === 'yearly') return packages.annual;
        return packages.tripPass;
    }, [packages, selected]);

    const tripPassPrice = priceLabel(packages?.tripPass ?? null);

    const openLegal = useCallback(
        async (slug: 'terms' | 'privacy') => {
            await Linking.openURL(buildLegalPageUrl(WEB_ORIGIN, slug, language));
        },
        [language],
    );

    const handlePurchase = useCallback(async () => {
        const pkg = selectedPackage;
        if (!pkg || busy) return;
        if (selected === 'trip_pass' && !groupId) {
            showAppToast({ type: 'info', titleKey: 'pro.paywall.tripPassNeedsGroup' });
            return;
        }
        setBusy(true);
        const result = await purchasePackage(pkg, { featureKey, groupId });
        setBusy(false);
        if (result.ok) {
            showAppToast({ type: 'success', titleKey: 'pro.paywall.purchaseSuccess' });
            onPurchaseSuccess?.();
        } else if (!result.userCancelled) {
            showAppToast({ type: 'error', titleKey: 'pro.paywall.purchaseError' });
        }
    }, [busy, featureKey, groupId, onPurchaseSuccess, selected, selectedPackage]);

    const handleRestore = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        const ok = await restorePurchases(featureKey, groupId);
        setBusy(false);
        if (ok) {
            showAppToast({ type: 'success', titleKey: 'pro.paywall.restoreSuccess' });
            onPurchaseSuccess?.();
        } else {
            showAppToast({ type: 'info', titleKey: 'pro.paywall.restoreNone' });
        }
    }, [busy, featureKey, groupId, onPurchaseSuccess]);

    const handleManage = useCallback(async () => {
        await openSubscriptionManagement();
        const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
        if (url) await Linking.openURL(url);
    }, []);

    const storeConfigured = isPurchasesConfigured();

    const subscriptionPlanKey = selected === 'monthly' ? 'monthly' : selected === 'yearly' ? 'yearly' : null;

    const showFreeTrial =
        subscriptionPlanKey != null &&
        planShowsFreeTrial(subscriptionPlanKey, packages, introEligibility);

    const disclosureText = useMemo(() => {
        if (loadFailedReason) {
            return '';
        }
        if (selected === 'trip_pass') {
            return t('pro.paywall.tripPassNoRenewal');
        }
        const price = priceLabel(selectedPackage);
        const period = t(subscriptionPeriodKey(selectedPackage));
        if (showFreeTrial) {
            return t('pro.paywall.trialRenewalDisclosure', { price, period });
        }
        return t('pro.paywall.renewalDisclosure', { price, period });
    }, [loadFailedReason, selected, selectedPackage, showFreeTrial, t]);

    const purchaseCta = useMemo(() => {
        if (!selectedPackage) return t('pro.paywall.subscribe');
        const price = priceLabel(selectedPackage);
        if (selected === 'trip_pass') {
            return t('pro.paywall.buyTripPass', { price });
        }
        if (showFreeTrial) {
            return t('pro.paywall.tryFreeTrialCta');
        }
        return t('pro.paywall.subscribeAtPrice', { price });
    }, [selected, selectedPackage, showFreeTrial, t]);

    const planPickerSection = useMemo(() => {
        if (loading) {
            return <ActivityIndicator className="my-8" testID="paywall-loading" />;
        }
        if (!storeConfigured) {
            return (
                <Text className="text-center text-gray-500 mb-6">
                    {t('pro.paywall.storeNotConfigured')}
                </Text>
            );
        }
        if (loadFailedReason) {
            return (
                <View className="mb-6 items-center gap-3">
                    <Text className="text-center text-gray-700 leading-5" testID="paywall-load-error">
                        {t('pro.paywall.loadFailed')}
                    </Text>
                    <Pressable
                        onPress={retryLoad}
                        className="rounded-xl border border-primary px-5 py-2"
                        testID="paywall-retry"
                    >
                        <Text className="text-primary font-semibold">{t('pro.paywall.retry')}</Text>
                    </Pressable>
                </View>
            );
        }
        return (
            <>
                <View className="gap-2 mb-3">
                    <PlanPicker
                        label={t('pro.paywall.planMonthly')}
                        price={priceLabel(packages?.monthly ?? null)}
                        selected={selected === 'monthly'}
                        onPress={() => setSelected('monthly')}
                        testID="paywall-pick-monthly"
                    />
                    <PlanPicker
                        label={t('pro.paywall.planYearly')}
                        price={priceLabel(packages?.annual ?? null)}
                        selected={selected === 'yearly'}
                        onPress={() => setSelected('yearly')}
                        testID="paywall-pick-yearly"
                        hint={t('pro.paywall.yearlyIncludesTripPass')}
                    />
                    {showTripPass ? (
                        <PlanPicker
                            label={t('pro.paywall.planTripPass')}
                            price={tripPassPrice}
                            selected={selected === 'trip_pass'}
                            onPress={() => setSelected('trip_pass')}
                            testID="paywall-pick-trip-pass"
                        />
                    ) : null}
                </View>

                {showTripPass && packages?.tripPass ? (
                    <Text className="text-sm text-gray-600 text-center mb-4 leading-5">
                        {t('pro.paywall.tripPassLine', { price: tripPassPrice })}
                    </Text>
                ) : null}
            </>
        );
    }, [loadFailedReason, loading, packages, retryLoad, selected, showTripPass, storeConfigured, t, tripPassPrice]);

    return (
        <ScrollView
            className="flex-1 bg-slate-50"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: 20,
            }}
        >
            {onClose ? (
                <Pressable
                    onPress={onClose}
                    className="self-end p-2 mb-2"
                    hitSlop={12}
                    testID="paywall-close"
                >
                    <AppIcon name="close" size={24} color={colors.gray500} />
                </Pressable>
            ) : null}

            <Text className="text-2xl font-bold text-gray-900 text-center mb-6">
                {t('pro.paywall.title')}
            </Text>

            <View className="gap-2 mb-6">
                {[1, 2, 3].map(i => (
                    <View key={i} className="flex-row items-start gap-2">
                        <AppIcon name="checkmark-circle" size={20} color={colors.success.DEFAULT} />
                        <Text className="flex-1 text-gray-800 text-base">
                            {t(`pro.paywall.feature${i}` as 'pro.paywall.feature1')}
                        </Text>
                    </View>
                ))}
            </View>

            {planPickerSection}

            <Pressable
                onPress={() => setEuDigitalAck(v => !v)}
                className="flex-row items-start gap-3 mb-4 px-1"
                testID="paywall-eu-withdrawal-ack"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: euDigitalAck }}
            >
                <View
                    className={`mt-0.5 h-5 w-5 rounded border items-center justify-center ${euDigitalAck ? 'bg-primary border-primary' : 'border-gray-400 bg-white'}`}
                >
                    {euDigitalAck ? (
                        <AppIcon name="checkmark" size={14} color="#fff" />
                    ) : null}
                </View>
                <Text className="flex-1 text-xs text-gray-600 leading-5">
                    {t('pro.paywall.euDigitalPurchaseAck')}
                </Text>
            </Pressable>

            <Pressable
                onPress={handlePurchase}
                disabled={
                    busy ||
                    !storeConfigured ||
                    !selectedPackage ||
                    loading ||
                    !!loadFailedReason ||
                    !euDigitalAck
                }
                className="bg-primary rounded-2xl py-4 items-center mb-3"
                testID="paywall-purchase-btn"
            >
                {busy ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text className="text-white font-bold text-base text-center">{purchaseCta}</Text>
                )}
            </Pressable>

            <Text className="text-xs text-gray-500 leading-5 mb-4 text-center">{disclosureText}</Text>

            <View className="flex-row flex-wrap justify-center gap-4 mb-4">
                <Pressable onPress={() => openLegal('terms')}>
                    <Text className="text-primary text-sm underline">{t('settings.terms')}</Text>
                </Pressable>
                <Pressable onPress={() => openLegal('privacy')}>
                    <Text className="text-primary text-sm underline">{t('settings.privacy')}</Text>
                </Pressable>
            </View>

            <Pressable
                onPress={handleRestore}
                disabled={busy || !storeConfigured}
                className="py-3 items-center"
                testID="paywall-restore"
            >
                <Text className="text-primary font-semibold">{t('pro.paywall.restore')}</Text>
            </Pressable>

            <Pressable onPress={handleManage} className="py-3 items-center" testID="paywall-manage">
                <Text className="text-gray-600 text-sm">{t('pro.paywall.manageSubscription')}</Text>
            </Pressable>
        </ScrollView>
    );
}

type PlanPickerProps = Readonly<{
    label: string;
    price: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
    hint?: string;
}>;

function PlanPicker({ label, price, selected, onPress, testID, hint }: PlanPickerProps) {
    return (
        <Pressable
            onPress={onPress}
            testID={testID}
            className={`rounded-2xl border p-3 flex-row items-center justify-between ${selected ? 'border-primary bg-blue-50' : 'border-gray-200 bg-white'}`}
        >
            <View className="flex-1 pe-2">
                <Text className="text-base font-semibold text-gray-900">{label}</Text>
                {hint ? <Text className="text-xs text-gray-500 mt-1">{hint}</Text> : null}
            </View>
            <Text className="text-base font-bold text-gray-900">{price}</Text>
        </Pressable>
    );
}
