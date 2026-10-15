/**
 * RevenueCat wrapper — no-ops when Pro flag off or platform keys missing.
 */

import { Platform } from 'react-native';
import {
    REVENUECAT_ENTITLEMENT_PRO,
    REVENUECAT_PACKAGE_ANNUAL,
    REVENUECAT_PACKAGE_MONTHLY,
    REVENUECAT_PACKAGE_TRIP_PASS,
    STORE_PRODUCT_TRIP_PASS,
} from '../lib/proConstants';
import { registerTripPassPurchaseIntent } from './proEntitlements.service';
import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import { logMonetizationEvent } from './monetization.service';
import { captureProductEvent } from '../lib/productAnalytics';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';
import type { PaywallPackages, PurchasesPackageLike } from '../lib/purchasesPackage.types';
import {
    collectSubscriptionProductIds,
    type IntroEligibilityMap,
} from '../lib/proTrialPaywall';
import { syncProTrialReminder } from './proTrialReminder.service';

export type { PaywallPackages, PurchasesPackageLike };
export type { IntroEligibilityMap };

export interface ProSubscriptionUiState {
    isInFreeTrial: boolean;
    trialEndsAt: string | null;
    manageSubscriptionsAvailable: boolean;
}

type PurchasesModule = typeof import('react-native-purchases');
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;

let purchasesMod: PurchasesModule | null = null;
let configured = false;
let customerInfoListenerAttached = false;

function platformApiKey(): string | null {
    const key =
        Platform.OS === 'ios'
            ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
            : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    const trimmed = key?.trim();
    return trimmed || null;
}

export function isPurchasesConfigured(): boolean {
    return KUPAPAY_PRO_ENABLED && !!platformApiKey();
}

async function getPurchases(): Promise<PurchasesModule | null> {
    if (!isPurchasesConfigured()) return null;
    if (!purchasesMod) {
        purchasesMod = await import('react-native-purchases');
    }
    return purchasesMod;
}

export async function configurePurchasesForUser(userId: string): Promise<void> {
    const Purchases = await getPurchases();
    const apiKey = platformApiKey();
    if (!Purchases || !apiKey) return;

    if (!configured) {
        Purchases.default.setLogLevel(Purchases.LOG_LEVEL.WARN);
        Purchases.default.configure({ apiKey });
        configured = true;
    }
    await Purchases.default.logIn(userId);

    if (!customerInfoListenerAttached) {
        Purchases.default.addCustomerInfoUpdateListener(info => {
            void syncProTrialReminder({
                entitlementId: REVENUECAT_ENTITLEMENT_PRO,
                customerInfo: info as Parameters<typeof syncProTrialReminder>[0]['customerInfo'],
            });
        });
        customerInfoListenerAttached = true;
    }

    const info = await Purchases.default.getCustomerInfo();
    await syncProTrialReminder({
        entitlementId: REVENUECAT_ENTITLEMENT_PRO,
        customerInfo: info as Parameters<typeof syncProTrialReminder>[0]['customerInfo'],
    });
}

export async function logOutPurchases(): Promise<void> {
    const Purchases = await getPurchases();
    if (!Purchases || !configured) return;
    try {
        await Purchases.default.logOut();
    } catch {
        // ignore
    }
}

export async function checkIntroductoryPriceEligibility(
    packages: PaywallPackages | null,
): Promise<IntroEligibilityMap> {
    const Purchases = await getPurchases();
    if (!Purchases || !packages) return {};
    const productIds = collectSubscriptionProductIds(packages);
    try {
        return await Purchases.default.checkTrialOrIntroductoryPriceEligibility(productIds);
    } catch {
        return {};
    }
}

export async function fetchProSubscriptionUiState(): Promise<ProSubscriptionUiState> {
    const empty: ProSubscriptionUiState = {
        isInFreeTrial: false,
        trialEndsAt: null,
        manageSubscriptionsAvailable: false,
    };
    const Purchases = await getPurchases();
    if (!Purchases) return empty;

    try {
        const info = await Purchases.default.getCustomerInfo();
        const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
        if (!ent) return { ...empty, manageSubscriptionsAvailable: true };

        const periodType = ent.periodType;
        const inTrial = periodType === 'TRIAL' || periodType === 'INTRO';
        return {
            isInFreeTrial: inTrial,
            trialEndsAt: inTrial ? (ent.expirationDate ?? null) : null,
            manageSubscriptionsAvailable: true,
        };
    } catch {
        return empty;
    }
}

export async function loadOfferingPackages(): Promise<PaywallPackages> {
    const empty: PaywallPackages = { monthly: null, annual: null, tripPass: null };
    const Purchases = await getPurchases();
    if (!Purchases) return empty;

    const offeringId =
        process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() || 'default';
    const offerings = await Purchases.default.getOfferings();
    const offering = offerings.all[offeringId] ?? offerings.current;
    if (!offering) return empty;

    const find = (id: string) =>
        offering.availablePackages.find(p => p.identifier === id) ?? null;

    return {
        monthly: find(REVENUECAT_PACKAGE_MONTHLY),
        annual: find(REVENUECAT_PACKAGE_ANNUAL),
        tripPass: find(REVENUECAT_PACKAGE_TRIP_PASS),
    };
}

async function trackPurchaseEvent(
    event: 'purchase_started' | 'purchase_completed' | 'purchase_failed' | 'restore_completed' | 'restore_failed',
    featureKey: string,
    extra?: Record<string, string>,
): Promise<void> {
    void logMonetizationEvent(featureKey, event);
    if (event === 'restore_completed') {
        await captureProductEvent('restore', { result: 'ok', ...extra });
        return;
    }
    if (event === 'restore_failed') {
        await captureProductEvent('restore', { result: 'failed', ...extra });
        return;
    }
    await captureProductEvent(event, extra);
}

export async function purchasePackage(
    pkg: PurchasesPackageLike,
    opts: { featureKey: string; groupId?: string },
): Promise<{ ok: true } | { ok: false; userCancelled?: boolean }> {
    const Purchases = await getPurchases();
    if (!Purchases) return { ok: false };

    const isTripPassPkg =
        pkg.identifier === REVENUECAT_PACKAGE_TRIP_PASS ||
        pkg.product.identifier === STORE_PRODUCT_TRIP_PASS;

    if (isTripPassPkg && opts.groupId) {
        const intent = await registerTripPassPurchaseIntent(opts.groupId);
        if (!intent.ok) {
            await trackPurchaseEvent('purchase_failed', opts.featureKey, {
                package_id: pkg.identifier,
                reason: intent.error,
            });
            return { ok: false };
        }
    }

    if (opts.groupId) {
        await Purchases.default.setAttributes({ group_id: opts.groupId });
    }

    await trackPurchaseEvent('purchase_started', opts.featureKey, {
        package_id: pkg.identifier,
    });

    try {
        const { customerInfo } = await Purchases.default.purchasePackage(pkg as PurchasesPackage);
        const active = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
        const tripPassPurchased =
            isTripPassPkg ||
            customerInfo.nonSubscriptionTransactions.some(
                t => t.productIdentifier === STORE_PRODUCT_TRIP_PASS,
            );
        if (active || tripPassPurchased) {
            await trackPurchaseEvent('purchase_completed', opts.featureKey, {
                package_id: pkg.identifier,
            });
            const periodType = active?.periodType;
            if (
                active &&
                !isTripPassPkg &&
                (periodType === 'TRIAL' || periodType === 'INTRO')
            ) {
                await captureProductEvent('trial_started', {
                    package_id: pkg.identifier,
                    feature_key: opts.featureKey,
                });
            }
            if (active && !isTripPassPkg) {
                await syncProTrialReminder({
                    entitlementId: REVENUECAT_ENTITLEMENT_PRO,
                    customerInfo: customerInfo as Parameters<
                        typeof syncProTrialReminder
                    >[0]['customerInfo'],
                });
            }
            await invalidateProQueries(opts.groupId);
            return { ok: true };
        }
        await trackPurchaseEvent('purchase_failed', opts.featureKey, {
            package_id: pkg.identifier,
            reason: 'no_entitlement',
        });
        return { ok: false };
    } catch (e: unknown) {
        const userCancelled =
            typeof e === 'object' &&
            e != null &&
            'userCancelled' in e &&
            (e as { userCancelled?: boolean }).userCancelled === true;
        if (!userCancelled) {
            await trackPurchaseEvent('purchase_failed', opts.featureKey, {
                package_id: pkg.identifier,
            });
        }
        return { ok: false, userCancelled };
    }
}

export async function restorePurchases(featureKey: string, groupId?: string): Promise<boolean> {
    const Purchases = await getPurchases();
    if (!Purchases) return false;
    try {
        await trackPurchaseEvent('purchase_started', featureKey, { action: 'restore' });
        const info = await Purchases.default.restorePurchases();
        const active = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
        if (active) {
            await trackPurchaseEvent('restore_completed', featureKey);
            await syncProTrialReminder({
                entitlementId: REVENUECAT_ENTITLEMENT_PRO,
                customerInfo: info as Parameters<typeof syncProTrialReminder>[0]['customerInfo'],
            });
            await invalidateProQueries(groupId);
            return true;
        }
        await trackPurchaseEvent('restore_failed', featureKey);
        return false;
    } catch {
        await trackPurchaseEvent('restore_failed', featureKey);
        return false;
    }
}

async function invalidateProQueries(groupId?: string): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.proStatus() });
    if (groupId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.proStatus(groupId) });
    }
}

export async function openSubscriptionManagement(): Promise<void> {
    const Purchases = await getPurchases();
    if (!Purchases) return;
    try {
        await Purchases.default.showManageSubscriptions();
    } catch {
        // Platform may not support — caller can fall back to store URL
    }
}
