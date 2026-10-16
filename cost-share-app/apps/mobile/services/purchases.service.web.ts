/**
 * Web stub — RevenueCat / react-native-purchases is native-only (App Store / Play).
 * Pro IAP is not offered on Expo web; paywall shows store-not-configured.
 */

import type { PaywallPackages, PurchasesPackageLike } from '../lib/purchasesPackage.types';

export type { PaywallPackages, PurchasesPackageLike };

export function isPurchasesConfigured(): boolean {
    return false;
}

export async function configurePurchasesForUser(_userId: string): Promise<void> {}

export async function waitForPurchasesReady(): Promise<boolean> {
    return false;
}

export async function logOutPurchases(): Promise<void> {}

export async function loadOfferingPackages(): Promise<PaywallPackages> {
    return { monthly: null, annual: null, tripPass: null };
}

export async function checkIntroductoryPriceEligibility(): Promise<
    Record<string, { status: number }>
> {
    return {};
}

export async function fetchProSubscriptionUiState(): Promise<{
    isInFreeTrial: boolean;
    trialEndsAt: string | null;
    manageSubscriptionsAvailable: boolean;
}> {
    return { isInFreeTrial: false, trialEndsAt: null, manageSubscriptionsAvailable: false };
}

export async function purchasePackage(
    _pkg: PurchasesPackageLike,
    _opts: { featureKey: string; groupId?: string },
): Promise<{ ok: true } | { ok: false; userCancelled?: boolean }> {
    return { ok: false };
}

export async function restorePurchases(_featureKey: string, _groupId?: string): Promise<boolean> {
    return false;
}

export async function openSubscriptionManagement(): Promise<void> {}
